vault {
  address = "http://vault:8200"
}

auto_auth {
  method {
    type = "approle"

    config = {
      role_id_file_path                  = "/vault/file/postgres-pki-role-id"
      secret_id_file_path                = "/credentials/secret_id"
      remove_secret_id_file_after_reading = false
    }
  }
}

template_config {
  exit_on_retry_failure = true
}

template {
  destination          = "/run/postgres-tls/.postgres-agent.pem"
  perms                = "0600"
  error_on_missing_key = true
  command              = "/usr/local/bin/install-postgres-pki"

  contents = <<EOF
{{- with pkiCert "pki/issue/postgres" "common_name=postgres" "alt_names=postgres" -}}
{{ .Cert }}{{ .CA }}
__POSTGRES_PKI_KEY__
{{ .Key }}
{{- end -}}
EOF
}
