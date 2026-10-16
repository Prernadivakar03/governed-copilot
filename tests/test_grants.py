def test_app_schema_hidden_from_analyst():
    with _connect("analyst") as conn:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute("SELECT * FROM app.users")