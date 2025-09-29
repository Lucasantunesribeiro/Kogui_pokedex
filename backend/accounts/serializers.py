from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.exceptions import ValidationError
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "is_staff", "date_joined")
        read_only_fields = ("id", "username", "email", "is_staff", "date_joined")


class AdminUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, required=False)

    class Meta:
        model = User
        fields = ("id", "username", "email", "is_staff", "is_active", "password", "date_joined")
        read_only_fields = ("id", "date_joined")
        extra_kwargs = {
            "password": {"write_only": True},
            "email": {"required": False, "allow_blank": True},
        }

    def validate_password(self, value):
        if value:
            try:
                validate_password(value)
            except ValidationError as exc:
                raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        email = validated_data.get("email")

        if email == "":
            validated_data["email"] = None

        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            # Senha padrão para usuários criados pelo admin
            user.set_password("kogui123")

        try:
            user.full_clean()
        except ValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc

        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        email = validated_data.get("email")
        if email == "":
            validated_data["email"] = None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        try:
            instance.full_clean()
        except ValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc

        instance.save()
        return instance


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "password_confirm")
        read_only_fields = ("id",)
        extra_kwargs = {
            "email": {"required": False, "allow_blank": True},
            "password": {"write_only": True},
        }

    def validate(self, attrs):
        password = attrs.get("password")
        password_confirm = attrs.get("password_confirm")

        if password_confirm:
            if password != password_confirm:
                raise serializers.ValidationError(
                    {"password_confirm": ["As senhas não conferem."]}
                )
        if not password:
            raise serializers.ValidationError({"password": ["Senha obrigatória."]})

        user = User(username=attrs.get("username"), email=attrs.get("email"))
        try:
            validate_password(password, user)
        except ValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc

        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm", None)
        password = validated_data.pop("password")

        email = validated_data.get("email")
        if email == "":
            validated_data["email"] = None

        user = User(**validated_data)
        user.set_password(password)
        try:
            user.full_clean()
        except ValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
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
        new_password = attrs.get("new_password")
        new_password_confirm = attrs.get("new_password_confirm")

        if new_password != new_password_confirm:
            raise serializers.ValidationError({"new_password_confirm": "As senhas não conferem."})

        user = self.context["request"].user
        try:
            validate_password(new_password, user)
        except ValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)}) from exc

        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        new_password = self.validated_data["new_password"]
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return user


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Usuário com este e-mail não encontrado.")
        return value

    def save(self, **kwargs):
        email = self.validated_data["email"]
        user = User.objects.get(email=email)

        token_generator = PasswordResetTokenGenerator()
        token = token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        # Em produção, usar domínio real
        reset_url = f"http://localhost:4200/password-reset/{uid}/{token}/"

        # Enviar email (para desenvolvimento, apenas log)
        subject = "Redefinição de Senha - Kogui Pokédx"
        message = f"""
        Olá {user.username},

        Você solicitou a redefinição de sua senha. Clique no link abaixo para redefinir:
        {reset_url}

        Se você não solicitou esta alteração, ignore este e-mail.

        Equipe Kogui Pokédx
        """

        try:
            email_msg = EmailMessage(
                subject=subject,
                body=message,
                from_email="noreply@kogui.com",
                to=[email],
            )
            email_msg.send()
        except Exception:
            # Em desenvolvimento, apenas loggar
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Reset password email sent to {email}: {reset_url}")

        return {"detail": "E-mail de redefinição enviado com sucesso."}


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        uid = attrs.get("uid")
        token = attrs.get("token")
        new_password = attrs.get("new_password")
        new_password_confirm = attrs.get("new_password_confirm")

        if new_password != new_password_confirm:
            raise serializers.ValidationError({"new_password_confirm": "As senhas não conferem."})

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError({"uid": "UID inválido."})

        token_generator = PasswordResetTokenGenerator()
        if not token_generator.check_token(user, token):
            raise serializers.ValidationError({"token": "Token inválido ou expirado."})

        try:
            validate_password(new_password, user)
        except ValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)}) from exc

        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        new_password = self.validated_data["new_password"]
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return {"detail": "Senha redefinida com sucesso."}
