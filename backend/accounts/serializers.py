from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
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
