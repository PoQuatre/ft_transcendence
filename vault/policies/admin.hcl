path "sys/mounts" {
  capabilities = ["read"]
}

path "sys/mounts/secret" {
  capabilities = ["create", "read", "update", "delete", "sudo"]
}

path "sys/auth" {
  capabilities = ["read"]
}

path "sys/auth/approle" {
  capabilities = ["create", "read", "update", "delete", "sudo"]
}

path "sys/policies/acl" {
  capabilities = ["list"]
}

path "sys/policies/acl/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

path "auth/approle/role" {
  capabilities = ["list"]
}

path "auth/approle/role/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "secret/data/backend/database" {
  capabilities = ["create", "read", "update"]
}
