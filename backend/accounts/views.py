from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.generics import (
    ListCreateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    AdminCreateUserSerializer,
    AdminPasswordResetSerializer,
    AdminUserUpdateSerializer,
    PasswordChangeSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user: User = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Senha atualizada com sucesso."}, status=status.HTTP_200_OK)


class UserListCreateView(ListCreateAPIView):
    permission_classes = [IsAdminUser]
    queryset = User.objects.all().order_by("username")
    serializer_class = AdminCreateUserSerializer

    def get_serializer_class(self):
        return AdminCreateUserSerializer if self.request.method == "POST" else UserSerializer


class UserDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]
    queryset = User.objects.all()
    serializer_class = AdminUserUpdateSerializer

    def get(self, request, *args, **kwargs):
        instance = self.get_object()
        return Response(UserSerializer(instance).data)


class AdminPasswordResetView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, user_id: int, *args, **kwargs):
        try:
            target = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"detail": "Usuário não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminPasswordResetSerializer(data=request.data, context={"user": target})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Senha redefinida com sucesso."}, status=status.HTTP_200_OK)
