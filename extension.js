/*
 * Copyright © 2012 Will Thompson <will@willthompson.co.uk>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 */

const Lang = imports.lang;
const Main = imports.ui.main;

const GLib = imports.gi.GLib;
const Tp = imports.gi.TelepathyGLib;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;

function AccountGroupSection() {
    this._init.apply(this, arguments);
}

AccountGroupSection.prototype = {
    __proto__: PopupMenu.PopupMenuSection.prototype,

    _init: function(am, groupName, accountIDs) {
        PopupMenu.PopupMenuSection.prototype._init.call(this);

        this._am = am;

        this._switch = new PopupMenu.PopupSwitchMenuItem(groupName, true);
        this._switch.setStatus("loading\u2026");
        this.addMenuItem(this._switch);

        this._accountIDs = accountIDs;
        this._accounts = [];
    },

    helloThere: function(accounts) {
        let state = false;

        for (let i = 0; i < accounts.length; i++) {
            let account = accounts[i];
            if (this._accountIDs.indexOf(account.get_path_suffix()) >= 0) {
                this._accounts.push(account);
                /* If any account in this group is enabled, show the whole
                 * group as enabled.
                 */
                state = state || account.is_enabled();

                let nameItem = new PopupMenu.PopupMenuItem(account.get_display_name())
                this.addMenuItem(nameItem);
                nameItem.label.add_style_class_name('popup-inactive-menu-item');
                nameItem.actor.reactive = false;
                nameItem.actor.can_focus = false;
            }
        }

        if (this._accounts.length > 0) {
            this._switch.setToggleState(state);
            this._switch.setStatus(null);

            this._switch.connect('toggled', Lang.bind(this,
                function(item) { this._onToggled(item); }));
        } else {
            this._switch.setStatus("\u2639");
        }
    },

    _onToggled: function(item) {
        let state = item.state;

        for (let i = 0; i < this._accounts.length; i++) {
            let account = this._accounts[i];
            account.set_enabled_async(state, Lang.bind(this, function() {
                if (state) {
                    let [presence, status, msg] = this._am.get_most_available_presence();

                    account.request_presence_async(presence, status, msg,
                        function() {});
                }
            }));
        }

    },
}

function CAGMenu() {
    this._init();
}

CAGMenu.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'avatar-default-symbolic', null);

        this._am = Tp.AccountManager.dup();
        this._sections = [];

        let accountFile = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            "shell-chat-account-groups",
            "groups.json"]);
        try {
            /* Stupid. The first returned value is true. */
            let ret = GLib.file_get_contents(accountFile);
            let groups = JSON.parse(ret[1]);
            this._createSections(groups);
            this._prepare();
        } catch (error) {
            let errorMessage = "Couldn't load account groups:\n" + error + "\n" +
                "You need to fill in ~/.config/shell-chat-account-groups/groups.json";
            let errorItem = new PopupMenu.PopupMenuItem(errorMessage)
            errorItem.actor.reactive = false;
            errorItem.actor.can_focus = false;
            this.menu.addMenuItem(errorItem);
        }
    },

    _createSections: function(groups) {
        for (var groupName in groups) {
            let section = new AccountGroupSection(this._am, groupName, groups[groupName]);
            this.menu.addMenuItem(section);
            this._sections.push(section);
        }
    },

    _prepare: function() {
        this._am.prepare_async(null, Lang.bind(this,
            function(am) {
                let accounts = am.get_valid_accounts();

                for (let i = 0; i < this._sections.length; i++) {
                    this._sections[i].helloThere(accounts);
                }
            }));
    },
};

function init(metadata) {
}

let groupsMenu;

function enable() {
    groupsMenu = new CAGMenu;
    Main.panel.addToStatusArea('chat-account-groups-menu', groupsMenu);
}

function disable() {
    groupsMenu.destroy();
}
