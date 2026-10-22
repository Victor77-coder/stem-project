def scoped(scope: str):
    """Aplica ScopedRateThrottle (configurado em settings) a uma view de @api_view."""

    def wrap(view):
        view.cls.throttle_scope = scope
        return view

    return wrap
