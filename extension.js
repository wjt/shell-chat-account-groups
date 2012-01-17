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

const CollaboraAccounts = {
    "gabble/jabber/will_2ethompson_40collabora_2eco_2euk0": true,
    "idle/irc/wjt0": true
};

function CAGMenu() {
    this._init();
}

CAGMenu.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'avatar-default-symbolic', null);

        let widget = new PopupMenu.PopupSwitchMenuItem("Collabora", true);
        widget.setStatus("loading\u2026");

        this.menu.addMenuItem(widget);

        this._am = Tp.AccountManager.dup();
        this._accounts = [];
        this._am.prepare_async(null, Lang.bind(this,
            function(am) {
                let accounts = am.get_valid_accounts();
                let state = false;
                for (let i = 0; i < accounts.length; i++) {
                    let account = accounts[i];
                    if (account.get_path_suffix() in CollaboraAccounts) {
                        this._accounts.push(account);
                        /* If any of our work-y accounts are enabled, show the
                         * whole lot as enabled.
                         */
                        state = state || account.is_enabled();
                    }
                }

                widget.setToggleState(state);
                widget.setStatus(null);
                widget.connect('toggled', Lang.bind(this, this._collaboraToggled));
            }));
    },

    _collaboraToggled: function(item) {
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
