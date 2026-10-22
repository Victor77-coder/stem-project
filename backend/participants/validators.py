from decimal import Decimal, InvalidOperation

from rest_framework import serializers

from accounts.models import digits

UFS = set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split())


def valid_cpf(value: str) -> bool:
    cpf = digits(value)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    for size in (9, 10):
        total = sum(int(cpf[i]) * (size + 1 - i) for i in range(size))
        check = (total * 10) % 11 % 10
        if check != int(cpf[size]):
            return False
    return True


class LooseDecimalField(serializers.Field):
    """Aceita '68,5', '68.5' ou número, como o teclado decimal do app envia."""

    def __init__(self, *, min_value: Decimal, max_value: Decimal, places: int, label: str, **kwargs):
        self.min_value, self.max_value, self.places, self.what = min_value, max_value, places, label
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        if data in ('', None):
            return None
        try:
            value = Decimal(str(data).strip().replace(',', '.'))
        except InvalidOperation:
            raise serializers.ValidationError(f'Informe {self.what} em números.')
        if self.what == 'a altura' and value > 3:
            value = value / 100
        value = value.quantize(Decimal(1).scaleb(-self.places))
        if not self.min_value <= value <= self.max_value:
            raise serializers.ValidationError(f'Confira {self.what}.')
        return value

    def to_representation(self, value):
        return format_decimal(value)


def format_decimal(value: Decimal | None) -> str:
    if value is None:
        return ''
    text = format(value.normalize(), 'f')
    return text


def clean_cep(value: str) -> str:
    cep = digits(value)
    if cep and len(cep) != 8:
        raise serializers.ValidationError('O CEP deve ter 8 dígitos.')
    return cep


def clean_phone(value: str) -> str:
    phone = digits(value)
    if phone and len(phone) not in (10, 11):
        raise serializers.ValidationError('Informe o telefone com DDD.')
    return phone


def clean_uf(value: str) -> str:
    uf = (value or '').strip().upper()
    if uf and uf not in UFS:
        raise serializers.ValidationError('UF inválida.')
    return uf
