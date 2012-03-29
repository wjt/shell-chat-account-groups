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

function CAGMenu() {
    this._init();
}

CAGMenu.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'avatar-default-symbolic', null);
        this._widgets = {};
        this._accounts = {};

        let accountNames = Object.keys(Accounts).sort();

        for (var group in Accounts) {
            let widget = new PopupMenu.PopupSwitchMenuItem(group, true);
            widget.setStatus("loading\u2026");
            this.menu.addMenuItem(widget);
            this._widgets[group] = widget;
            this._accounts[group] = [];
        }

        this._am = Tp.AccountManager.dup();
        this._am.prepare_async(null, Lang.bind(this,
            function(am) {
                let accounts = am.get_valid_accounts();

                for (let group in Accounts) {
                    let widget = this._widgets[group];
                    let state = false;

                    for (let i = 0; i < accounts.length; i++) {
                        let account = accounts[i];
                        if (account.get_path_suffix() in Accounts[group]) {
                            this._accounts[group].push(account);
                            /* If any of our work-y accounts are enabled, show the
                             * whole lot as enabled.
                             */
                            state = state || account.is_enabled();
                        }
                    }

                    widget.setToggleState(state);
                    widget.setStatus(null);

                    /* If we don't do this stupid dance, all callbacks get the
                     * final group name. I hate how binding works in JavaScript
                     * and Python.
                     */
                    let groupAgain = group;
                    widget.connect('toggled', Lang.bind(this,
                        function(item) { this._toggled(groupAgain, item); }));
                }
            }));
    },

    _toggled: function(group, item) {
        let state = item.state;

        for (let i = 0; i < this._accounts[group].length; i++) {
            let account = this._accounts[group][i];
            account.set_enabled_async(state, Lang.bind(this, function() {
                if (state) {
                    let [presence, status, msg] = this._am.get_most_available_presence();

                    account.request_presence_async(presence, status, msg,
                        function() {});
                }
            }));
        }
    }
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
