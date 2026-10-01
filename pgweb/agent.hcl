vault {
	address = "http://vault:8200"
}

auto_auth {
	method {
		type = "approle"

		config = {
			role_id_file_path                  = "/vault/file/pgweb-role-id"
			secret_id_file_path                = "/credentials/secret_id"
			remove_secret_id_file_after_reading = false
		}
	}
}

template_config {
	exit_on_retry_failure = true
}

env_template "PGWEB_DATABASE_URL" {
	contents = <<EOF
{{- with secret "database/creds/app-admin" -}}
postgres://{{ .Data.username | urlquery }}:{{ .Data.password | urlquery }}@postgres:5432/postgres?sslmode=verify-full&sslrootcert=/etc/ssl/certs/rootCA.pem&role=app_admin
{{- end -}}
EOF
	error_on_missing_key = true
}

exec {
	command                   = ["/usr/local/bin/pgweb", "--bind=0.0.0.0", "--listen=8081"]
	restart_on_secret_changes = "always"
	restart_stop_signal       = "SIGTERM"
}
