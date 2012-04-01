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

const Tp = imports.gi.TelepathyGLib;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;

/* The values are string->bool dicts rather than arrays because I don't know
 * offhand how to check if a string is in an array.
 */
const Accounts = {
    "Me": {
        "salut/local_2dxmpp/account0": true,
        "gabble/jabber/will_40willthompson_2eco_2euk0": true
    },
    "Collabora": {
        "gabble/jabber/will_2ethompson_40collabora_2eco_2euk0": true,
        "idle/irc/wjt0": true
    },
    "SIP": {
        "sofiasip/sip/_31002739_40sipgate_2eco_2euk0": true,
        "sofiasip/sip/will_2ethompson_40voip_2ecollabora_2eco_2euk0": true
    },
    "Musicians": {
        "gabble/jabber/t_2dpain_40test_2ecollabora_2eco_2euk0": true,
        "gabble/jabber/lady_2dgaga_40test_2ecollabora_2eco_2euk0": true
    },
    "WE ARE SEX BOB-OMB!\nONE TWO THREE FOUR": {
        "gabble/jabber/scott_40sp_2elit0": true,
        "gabble/jabber/ramona_40sp_2elit0": true
    },
};

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
            if (account.get_path_suffix() in this._accountIDs) {
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

        let am = Tp.AccountManager.dup();
        let sections = [];

        for (var groupName in Accounts) {
            let section = new AccountGroupSection(am, groupName, Accounts[groupName]);
            this.menu.addMenuItem(section);
            sections.push(section);
        }

        am.prepare_async(null, Lang.bind(this,
            function(am) {
                let accounts = am.get_valid_accounts();

                for (let i = 0; i < sections.length; i++) {
                    sections[i].helloThere(accounts);
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
