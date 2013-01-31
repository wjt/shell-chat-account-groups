EXT_DIR=$(HOME)/.local/share/gnome-shell/extensions
UUID=`perl -nle 'if (m{"uuid": "([^"]+)"}) { print $$1 }' metadata.json`
FILES=\
	AUTHORS.md \
	COPYING \
	README.md \
	edit-groups \
	extension.js \
	metadata.json \
	$(null)

SCHEMA="org.gnome.shell"
KEY="enabled-extensions"
STATUS=$$(gsettings get $(SCHEMA) $(KEY) | grep "$(UUID)" > /dev/null 2>&1; if [ $$? = "0" ]; then echo "enabled"; else echo "disabled"; fi)

all:

install:
	@mkdir -p $(EXT_DIR)/$(UUID)
	@for f in $(FILES); do \
	    cp -f $$f $(EXT_DIR)/$(UUID)/$$f; \
	done
	@if [ $(STATUS) = "enabled" ]; then \
	    echo "To reload the shell (and the extension) press ALT-F2 and type 'r'."; \
	else \
	    echo "To enable the extension type 'make enable'."; \
	fi

uninstall: disable-internal
	@for f in $(FILES); do \
	    rm $(EXT_DIR)/$(UUID)/$$f; \
	done
	@rmdir $(EXT_DIR)/$(UUID)

enable: disable-internal
	@if [ ! -d $(EXT_DIR)/$(UUID) ]; then \
	    echo "Before enabling the extension you have to install it with 'make install'"; \
	    exit 1; \
	fi
	@curr_val=`gsettings get $(SCHEMA) $(KEY)`; \
	full_id="'$(UUID)'"; \
	other_extensions=`echo "$$curr_val" | sed -e "s/]$$//"`; \
	new_val="$$other_extensions, $$full_id]"; \
	new_val=`echo "$$new_val" | sed -e 's/\[, /[/'` ; \
	gsettings set $(SCHEMA) $(KEY) "$$new_val"
	@echo "To reload the shell (and the extension) press ALT-F2 and type 'r'."; \

disable: disable-internal
	@if [ $(STATUS) = "enabled" ]; then \
	    echo "I cannot disable the extension!"; \
	    exit 1; \
	fi

disable-internal:
	@curr_val=`gsettings get $(SCHEMA) $(KEY)`; \
	full_id="'$(UUID)'"; \
	new_val=`echo "$$curr_val" | sed -e "s/$$full_id//"`; \
	new_val=`echo "$$new_val" | sed -e 's/, ]/]/'` ; \
	new_val=`echo "$$new_val" | sed -e 's/\[, /[/'` ; \
	new_val=`echo "$$new_val" | sed -e 's/, ,/,/'` ; \
	gsettings set $(SCHEMA) $(KEY) "$$new_val"

status:
	@if [ $(STATUS) = "enabled" ]; then \
	    echo "The extension is enabled"; \
	else \
	    echo "The extension is disabled"; \
	fi

dist: $(FILES)
	git diff --no-ext-diff --quiet --exit-code # any uncommitted changes?
	zip -j shell-chat-account-groups-$(shell git describe).zip $(FILES)

clean:
	rm -f shell-chat-account-groups-*.zip
