import os

os.environ.setdefault('DJANGO_DEBUG', '1')
os.environ.setdefault('SECRET_KEY', 'test-secret-key-com-mais-de-32-bytes-para-o-jwt')
os.environ.pop('REDIS_URL', None)

from .settings import *  # noqa: E402,F403

PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
