from rest_framework.permissions import BasePermission


class IsParticipant(BasePermission):
    message = 'Disponível apenas para contas do aplicativo.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_participant)


class IsTeamMember(BasePermission):
    message = 'Disponível apenas para a equipe do painel.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_team and hasattr(user, 'staff'))


class IsTeamAdmin(IsTeamMember):
    message = 'Somente administradores podem executar essa função.'

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.staff.is_admin


class TeamReadAdminWrite(IsTeamMember):
    """Toda a equipe consulta; só administradores alteram."""

    message = IsTeamAdmin.message

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.method in ('GET', 'HEAD', 'OPTIONS') or request.user.staff.is_admin
