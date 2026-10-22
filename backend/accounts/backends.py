from django.contrib.auth.backends import ModelBackend


class StaffBackend(ModelBackend):
    """Django admin: só contas da equipe entram, nunca participantes do app."""

    def user_can_authenticate(self, user):
        return super().user_can_authenticate(user) and user.is_team
