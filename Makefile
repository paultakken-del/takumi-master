PROJECT_DIR := $(shell pwd)
INDEX       := $(PROJECT_DIR)/index.html
TEST        := $(PROJECT_DIR)/test/takumi_test.py
PROJECT     := takumi-master

.PHONY: test deploy

test:
	python3 $(TEST) $(INDEX)

deploy: test
	npx wrangler pages deploy $(PROJECT_DIR) --project-name=$(PROJECT) --commit-dirty=true
