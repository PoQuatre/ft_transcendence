DOCKER = podman
COMPOSE = $(DOCKER) compose
DEV_DIRS = frontend/.generated frontend/node_modules frontend/public/assets/game backend/tmp game/build
PASSWORD_VARS = POSTGRES_PASSWORD POSTGRES_VAULT_PASSWORD
ROLE_VARS = BOOTSTRAP_ROLE_ID BACKEND_ROLE_ID MIGRATE_ROLE_ID PGWEB_ROLE_ID
JFLAG := $(filter -j%,$(MAKEFLAGS))
HELP_RESET = \033[0m
HELP_BOLD = \033[1m
HELP_SECTION = \033[1;36m
HELP_TARGET = \033[32m

.PHONY: help
help:
	@printf '%b\n' \
		'$(HELP_BOLD)Usage: make <target>$(HELP_RESET)' \
		'' \
		'$(HELP_SECTION)Environment:$(HELP_RESET)' \
		'  $(HELP_TARGET)setup$(HELP_RESET)              Install project dependencies and configure the game build.' \
		'  $(HELP_TARGET)env$(HELP_RESET)                Generate a local .env file with required secrets.' \
		'' \
		'$(HELP_SECTION)Quality:$(HELP_RESET)' \
		'  $(HELP_TARGET)test$(HELP_RESET)               Run all test suites.' \
		'  $(HELP_TARGET)test-frontend$(HELP_RESET)      Run frontend tests.' \
		'  $(HELP_TARGET)test-backend$(HELP_RESET)       Run backend tests.' \
		'  $(HELP_TARGET)test-game$(HELP_RESET)          Build and run game tests.' \
		'  $(HELP_TARGET)lint$(HELP_RESET)               Run all linters.' \
		'  $(HELP_TARGET)lint-fix$(HELP_RESET)           Apply available lint fixes.' \
		'  $(HELP_TARGET)format$(HELP_RESET)             Check formatting.' \
		'  $(HELP_TARGET)format-fix$(HELP_RESET)         Apply formatting fixes.' \
		'' \
		'$(HELP_SECTION)Services:$(HELP_RESET)' \
		'  $(HELP_TARGET)start$(HELP_RESET)              Start production services.' \
		'  $(HELP_TARGET)dev$(HELP_RESET)                Start development services.' \
		'  $(HELP_TARGET)down$(HELP_RESET)               Stop services.' \
		'  $(HELP_TARGET)downv$(HELP_RESET)              Stop services and remove volumes.' \
		'  $(HELP_TARGET)ps$(HELP_RESET)                 Show service status.' \
		'  $(HELP_TARGET)logs$(HELP_RESET)               Follow service logs.' \
		'  $(HELP_TARGET)certs$(HELP_RESET)              Create local TLS certificates when missing.' \
		'' \
		'$(HELP_SECTION)Database:$(HELP_RESET)' \
		'  $(HELP_TARGET)db-generate$(HELP_RESET)        Generate a named database migration (NAME=<name>).' \
		'  $(HELP_TARGET)db-up$(HELP_RESET)              Apply database migrations.' \
		'  $(HELP_TARGET)db-down$(HELP_RESET)            Revert the latest database migration.' \
		'  $(HELP_TARGET)db-status$(HELP_RESET)          Show database migration status.' \
		'' \
		'$(HELP_SECTION)Cleanup:$(HELP_RESET)' \
		'  $(HELP_TARGET)fclean$(HELP_RESET)             Remove generated caches, build output, and frontend dependencies.'

.PHONY: setup
setup:
	mise install || true
	cd frontend && pnpm install
	cd backend && go mod download
	cd game && cmake --preset native-debug

.PHONY: fclean
fclean:
	$(RM) -r .cache backend/bin/ frontend/dist/ frontend/node_modules/ game/.cache/ game/build/ game/compile_commands.json

.PHONY: test
test: test-frontend test-backend test-game

.PHONY: test-frontend
test-frontend:
	cd frontend && pnpm test run

.PHONY: test-backend
test-backend:
	cd backend && go test ./...

.PHONY: test-game
test-game:
	cd game && cmake --preset native-debug
	cd game && cmake --build --preset native-debug $(JFLAG)
	cd game && ctest --preset native-debug $(JFLAG)

.PHONY: lint
lint: lint-frontend lint-backend lint-game lint-sql lint-migrations

.PHONY: lint-frontend
lint-frontend:
	cd frontend && pnpm lint

.PHONY: lint-backend
lint-backend:
	cd backend && golangci-lint run --show-stats=false

.PHONY: lint-game
lint-game:
	cd game && cmake --preset native-debug
ifneq ($(JFLAG),)
	cd game && run-clang-tidy -hide-progress -quiet -use-color -extra-arg-before=-resource-dir="$$(clang -print-resource-dir)" -p build/native-debug -j $(or $(patsubst -j%,%,$(JFLAG)),0) $$(git ls-files -- '*.cpp')
else
	cd game && clang-tidy -quiet -extra-arg-before=-resource-dir="$$(clang -print-resource-dir)" -p build/native-debug $$(git ls-files -- '*.cpp')
endif

.PHONY: lint-sql
lint-sql:
	sqlfluff lint $$(git ls-files -- '*.sql')

.PHONY: lint-migrations
lint-migrations:
	bash .github/scripts/check-migrations.sh

.PHONY: lint-fix
lint-fix: lint-fix-frontend lint-fix-backend lint-fix-game lint-fix-sql

.PHONY: lint-fix-frontend
lint-fix-frontend:
	cd frontend && pnpm lint-fix

.PHONY: lint-fix-backend
lint-fix-backend:
	cd backend && golangci-lint run --show-stats=false --fix

.PHONY: lint-fix-game
lint-fix-game:
	cd game && cmake --preset native-debug
ifneq ($(JFLAG),)
	cd game && run-clang-tidy -hide-progress -quiet -use-color -fix -extra-arg-before=-resource-dir="$$(clang -print-resource-dir)" -p build/native-debug -j $(or $(patsubst -j%,%,$(JFLAG)),0) $$(git ls-files -- '*.cpp')
else
	cd game && clang-tidy --quiet --fix -extra-arg-before=-resource-dir="$$(clang -print-resource-dir)" -p build/native-debug $$(git ls-files -- '*.cpp')
endif

.PHONY: lint-fix-sql
lint-fix-sql:
	sqlfluff fix --dialect postgres $$(git ls-files -- '*.sql')

.PHONY: format
format: format-frontend format-backend format-game format-sql

.PHONY: format-frontend
format-frontend:
	cd frontend && pnpm format

.PHONY: format-backend
format-backend:
	cd backend && golangci-lint fmt --diff

.PHONY: format-game
format-game:
	cd game && clang-format --dry-run --Werror $$(git ls-files -- '*.cpp' '*.hpp')

.PHONY: format-sql
format-sql:
	@files="$$(git ls-files -- '*.sql')"; \
	trap 'for file in $$files; do rm -f "$${file%.sql}.sqlfluff-format.sql"; done' 0; \
	set -e; \
	sqlfluff format --dialect postgres --fixed-suffix .sqlfluff-format $$files; \
	for file in $$files; do \
		[ ! -e "$${file%.sql}.sqlfluff-format.sql" ] || { echo "$$file is not formatted"; exit 1; }; \
	done

.PHONY: format-fix
format-fix: format-fix-frontend format-fix-backend format-fix-game format-fix-sql

.PHONY: format-fix-frontend
format-fix-frontend:
	cd frontend && pnpm format-fix

.PHONY: format-fix-backend
format-fix-backend:
	cd backend && golangci-lint fmt

.PHONY: format-fix-game
format-fix-game:
	cd game && clang-format -i $$(git ls-files -- '*.cpp' '*.hpp')

.PHONY: format-fix-sql
format-fix-sql:
	sqlfluff format --dialect postgres $$(git ls-files -- '*.sql')

.PHONY: start
start: certs env
	$(COMPOSE) -f compose.yml -f compose.prod.yml up --build --force-recreate -d

.PHONY: dev
dev: certs env $(DEV_DIRS)
	$(COMPOSE) -f compose.yml -f compose.dev.yml up --build --force-recreate -d

$(DEV_DIRS):
	mkdir -p $@

.PHONY: db-generate
db-generate: db-up
	$(COMPOSE) -f compose.yml -f compose.prod.yml run --rm --no-deps --build --user 0:0 migrate /usr/local/bin/api migrate generate '$(NAME)'

.PHONY: db-up
db-up: env
	$(COMPOSE) -f compose.yml -f compose.prod.yml run --rm --no-deps migrate /usr/local/bin/api migrate up

.PHONY: db-down
db-down: env
	$(COMPOSE) -f compose.yml -f compose.prod.yml run --rm --no-deps migrate /usr/local/bin/api migrate down

.PHONY: db-status
db-status: env
	$(COMPOSE) -f compose.yml -f compose.prod.yml run --rm --no-deps migrate /usr/local/bin/api migrate status

.PHONY: certs
certs:
	@if [ ! -f certs/rootCA.pem ] || [ ! -f certs/localhost.pem ] || [ ! -f certs/localhost-key.pem ]; then \
		mkdir -p certs && \
		if command -v mkcert >/dev/null; then \
			mkcert -cert-file certs/localhost.pem -key-file certs/localhost-key.pem localhost $$(uname -n) nginx 127.0.0.1 ::1 && \
			cp "$$(mkcert -CAROOT)/rootCA.pem" certs/rootCA.pem; \
		else \
			openssl req -x509 -new -nodes -newkey rsa:2048 \
				-keyout certs/rootCA-key.pem -out certs/rootCA.pem -days 365 \
				-subj '/CN=localhost CA' && \
			openssl req -new -nodes -newkey rsa:2048 \
				-keyout certs/localhost-key.pem -out certs/localhost.csr \
				-subj '/CN=localhost' && \
			printf '%s\n' \
				'basicConstraints=CA:FALSE' \
				'keyUsage=critical,digitalSignature,keyEncipherment' \
				'extendedKeyUsage=serverAuth' \
				"subjectAltName=DNS:localhost,DNS:$$(uname -n),DNS:nginx,IP:127.0.0.1,IP:::1" | \
				openssl x509 -req -in certs/localhost.csr \
					-CA certs/rootCA.pem -CAkey certs/rootCA-key.pem -CAcreateserial \
					-out certs/localhost.pem -days 365 -extfile /dev/stdin && \
			rm certs/rootCA-key.pem certs/localhost.csr certs/rootCA.srl; \
		fi; \
		chmod 644 certs/rootCA.pem certs/localhost.pem certs/localhost-key.pem; \
	fi

.PHONY: env
env:
	@umask 077; touch .env; \
	for v in $(PASSWORD_VARS); do \
		grep -q "^$$v=" .env || printf '%s=%s\n' "$$v" "$$(openssl rand -hex 32)" >> .env; \
	done; \
	for v in $(ROLE_VARS); do \
		grep -q "^$$v=" .env || printf '%s=%s\n' "$$v" "$$(cat /proc/sys/kernel/random/uuid)" >> .env; \
	done

.PHONY: down
down: env
	$(COMPOSE) -f compose.yml -f compose.prod.yml -f compose.dev.yml down

.PHONY: downv
downv: env
	$(COMPOSE) -f compose.yml -f compose.prod.yml -f compose.dev.yml down -v

.PHONY: ps
ps: env
	$(COMPOSE) -f compose.yml -f compose.prod.yml -f compose.dev.yml ps

.PHONY: logs
logs: env
	$(COMPOSE) -f compose.yml -f compose.prod.yml -f compose.dev.yml logs -f
