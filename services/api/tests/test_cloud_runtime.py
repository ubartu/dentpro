import os
import subprocess
import sys

import pytest

from dentpro import runtime


def test_cloud_configuration_rejects_insecure_database_and_origins(monkeypatch):
    monkeypatch.setenv('APP_ENV', 'cloud')
    monkeypatch.setenv('DATABASE_URL', 'sqlite:///unsafe.db')
    monkeypatch.delenv('DATABASE_URL_FILE', raising=False)
    with pytest.raises(RuntimeError, match='PostgreSQL'):
        runtime.database_url()
    monkeypatch.setenv('DATABASE_URL', 'postgresql+psycopg://u:p@db.example/dentpro?sslmode=require')
    with pytest.raises(RuntimeError, match='verify-full'):
        runtime.database_url()
    monkeypatch.setenv('DENTPRO_CORS_ORIGINS', 'http://staff.example.com')
    with pytest.raises(RuntimeError, match='HTTPS'):
        runtime.cors_origins()
    monkeypatch.setenv('DATABASE_URL', 'postgresql+psycopg://u:p@db.example/dentpro?sslmode=verify-full')
    monkeypatch.setenv('DENTPRO_CORS_ORIGINS', 'https://staff.example.com')
    assert runtime.database_url().startswith('postgresql+psycopg://')
    assert runtime.cors_origins() == ['https://staff.example.com']


def test_new_passwords_use_argon2id_and_legacy_local_hashes_still_verify():
    import hashlib
    from dentpro.auth import password_hash, password_matches
    value = password_hash('SyntheticStrongPassword123!')
    assert value.startswith('$argon2id$')
    assert password_matches('SyntheticStrongPassword123!', value)
    assert not password_matches('wrong', value)
    salt = 'synthetic-salt'
    legacy = salt + ':' + hashlib.pbkdf2_hmac('sha256', b'old-demo-password', salt.encode(), 310000).hex()
    assert password_matches('old-demo-password', legacy)


def test_cloud_import_has_no_demo_session_or_public_api_docs():
    env = os.environ | {
        'APP_ENV': 'cloud',
        'DATABASE_URL': 'postgresql+psycopg://u:p@db.example/dentpro?sslmode=verify-full',
        'DENTPRO_CORS_ORIGINS': 'https://staff.example.com',
    }
    env.pop('DATABASE_URL_FILE', None)
    process = subprocess.run(
        [sys.executable, '-c', "from dentpro.main import app; from dentpro.auth import TOKENS; assert not TOKENS; assert app.docs_url is None; assert not any(getattr(r, 'path', '').startswith('/demo/') for r in app.routes)"],
        env=env, capture_output=True, text=True, timeout=20,
    )
    assert process.returncode == 0, process.stderr


def test_fresh_cloud_schema_has_settings_but_no_demo_accounts_or_cases(tmp_path):
    env = os.environ | {
        'APP_ENV': 'development',
        'DATABASE_URL': f'sqlite:///{tmp_path / "fresh.db"}',
    }
    env.pop('DATABASE_URL_FILE', None)
    code = (
        'from dentpro.cloud_schema import initialize_cloud_schema, SCHEMA_KEY; '
        'from dentpro.db import Session, Case; '
        'from dentpro.operations_models import Account, PlatformSetting; '
        'initialize_cloud_schema(); initialize_cloud_schema(); '
        'db=Session(); '
        'assert db.get(PlatformSetting,SCHEMA_KEY).value["version"]==1; '
        'assert db.query(Account).count()==0; assert db.query(Case).count()==0'
    )
    process = subprocess.run([sys.executable, '-c', code], env=env, capture_output=True, text=True, timeout=20)
    assert process.returncode == 0, process.stderr
