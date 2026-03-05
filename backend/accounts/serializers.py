from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.exceptions import ValidationError
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "is_staff", "date_joined")
        read_only_fields = ("id", "date_joined")


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "password_confirm")
        read_only_fields = ("id",)
        extra_kwargs = {
            "email": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        pwd = attrs.get("password")
        pwd2 = attrs.get("password_confirm")
        if pwd2 and pwd != pwd2:
            raise serializers.ValidationError({"password_confirm": ["As senhas não conferem."]})
        if not pwd:
            raise serializers.ValidationError({"password": ["Senha obrigatória."]})

        tmp_user = User(username=attrs.get("username"), email=attrs.get("email") or None)
        try:
            validate_password(pwd, tmp_user)
        except ValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm", None)
        password = validated_data.pop("password")
        email = validated_data.get("email") or None
        user = User(**{**validated_data, "email": email})
        user.set_password(password)
        try:
            user.full_clean()
        except ValidationError as exc:
            raise serializers.ValidationError(exc.message_dict)
        user.save()
        return user


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Senha atual incorreta.")
        return value

    def validate(self, attrs):
        p1 = attrs.get("new_password")
        p2 = attrs.get("new_password_confirm")
        if p1 != p2:
            raise serializers.ValidationError({"new_password_confirm": "As senhas não conferem."})
        try:
            validate_password(p1, self.context["request"].user)
        except ValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class AdminCreateUserSerializer(RegisterSerializer):
    is_staff = serializers.BooleanField(required=False, default=False)

    class Meta(RegisterSerializer.Meta):
        fields = RegisterSerializer.Meta.fields + ("is_staff",)

    def create(self, validated_data):
        is_staff = validated_data.pop("is_staff", False)
        user = super().create(validated_data)
        if is_staff:
            user.is_staff = True
            user.save(update_fields=["is_staff"])
        return user


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("username", "email", "is_staff")


class AdminPasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        p1 = attrs.get("new_password")
        p2 = attrs.get("new_password_confirm")
        if p1 != p2:
            raise serializers.ValidationError({"new_password_confirm": "As senhas não conferem."})
        target: User = self.context["user"]
        try:
            validate_password(p1, target)
        except ValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})
        return attrs

    def save(self, **kwargs):
        target: User = self.context["user"]
        target.set_password(self.validated_data["new_password"])
        target.save(update_fields=["password"])
        return target


# ===== Password Reset via Email (token-based) =====

class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value: str) -> str:
        # Não revelamos se o email existe (evita account enumeration - OWASP A01)
        return value

    def save(self, **kwargs) -> dict:
        email = self.validated_data["email"]
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Resposta silenciosa: não revelamos que o email não existe
            return {}

        token_generator = PasswordResetTokenGenerator()
        token = token_generator.make_token(user)

        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        # Em produção, enviar email aqui. Em dev/teste, apenas retornamos o token.
        return {"uid": uid, "token": token}


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        # Decodifica o uid
        try:
            uid = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError({"uid": "Link inválido."})

        # Valida o token
        token_generator = PasswordResetTokenGenerator()
        if not token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError({"token": "Token inválido ou expirado."})

        # Valida as senhas
        p1 = attrs.get("new_password")
        p2 = attrs.get("new_password_confirm")
        if p1 != p2:
            raise serializers.ValidationError({"new_password_confirm": "As senhas não conferem."})

        try:
            validate_password(p1, user)
        except ValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})

        attrs["_user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["_user"]
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user
