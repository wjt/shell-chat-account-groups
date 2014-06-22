/*
 * vim: set fileencoding=utf-8 sts=4 sw=4 et :
 *
 * Copyright © 2012–2013 Will Thompson <will@willthompson.co.uk>
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
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const TelepathyGLib = imports.gi.TelepathyGLib;

const debugEnabled = true;

function debug() {
    if (debugEnabled) {
        global.log(Array.prototype.join.call(arguments, ' '));
    }
}

function get_group_file_dir() {
        return GLib.build_filenamev([
            GLib.get_user_config_dir(),
            "shell-chat-account-groups"]);
}

function get_group_file_path() {
        return GLib.build_filenamev([
            get_group_file_dir(),
            "groups.2.json"]);
}

function get_old_group_file_path() {
        return GLib.build_filenamev([
            get_group_file_dir(),
            "groups.json"]);
}

const COL_IS_GROUP = 0;
const COL_NAME = 1;
const COL_OBJECT_PATH = 2;
const COL_IS_REMAINDER = 3;

const DRAGGING_GROUP = 1;
const DRAGGING_ACCOUNT = 2;

function makeAccountDictionary(accounts) {
    let dict = {};

    for (let i = 0; i < accounts.length; i++) {
        let account = accounts[i];

        dict[account.get_path_suffix()] = account
    }

    return dict;
}


const GroupModel = new Lang.Class({
    Name: 'ChatAccountGroupModel',
    Extends: Gtk.TreeStore,
    Implements: [ Gtk.TreeDragSource, Gtk.TreeDragDest ],

    Signals: {
        'loaded': { },
        'save-error': { param_types: [ GObject.TYPE_STRING ] }
    },

    _init: function(props) {
        let that = this;
        this.parent(props);

        this.set_column_types([GObject.TYPE_BOOLEAN, GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_BOOLEAN])

        this.accounts = {}
        this.save_timeout = null;

        this.dragging = null;

        this.am = TelepathyGLib.AccountManager.dup()
        this.am.prepare_async([], function(am, result) {
            am.prepare_finish(result);

            that.accounts = makeAccountDictionary(am.get_valid_accounts());
            that.load()
        });
    },

    add_group: function() {
        let [t, first_iter] = this.get_iter_first();
        let group_iter = this.insert_before(null, first_iter);
        this.set(group_iter,
            [ COL_IS_GROUP, COL_NAME, COL_OBJECT_PATH, COL_IS_REMAINDER ],
            [ true, "New group…", '', false ]);
        return group_iter;
    },

    iter_is_removable: function(tree_iter) {
        let [has_children, child_iter] = this.iter_children(tree_iter);
        return this.get_value(tree_iter, COL_IS_GROUP) &&
            !this.get_value(tree_iter, COL_IS_REMAINDER) &&
            !has_children;
    },

    vfunc_row_draggable: function() {
        return true;
    },

    vfunc_row_drop_possible: function() {
        return true;
    },

/*
    def do_row_draggable(self, path):
        is_group, is_remainder = self.get(self.get_iter(path),
            self.COL_IS_GROUP, self.COL_IS_REMAINDER)
        if not is_group:
            self.dragging = self.DRAGGING_ACCOUNT
            return true
        elif is_remainder:
            self.dragging = None
            return false
        else:
            self.dragging = self.DRAGGING_GROUP
            return true

    def do_row_drop_possible(self, path, data):
        if self.dragging == self.DRAGGING_ACCOUNT:
            return path.get_depth() == 2
        elif self.dragging == self.DRAGGING_GROUP:
            # FIXME: Don't allow dropping below remainder
            return path.get_depth() == 1
        else:
            return false

    def try_load_legacy(self):
        try:
            with open(self.get_old_group_file_path(), 'r') as f:
                data = json.load(f)
                new_data = []

                for group_name, paths in data.iteritems():
                    new_data.append(
                        { "name": group_name,
                          "accounts": paths,
                        })

                # Schedule a save to write out in the new format
                self.schedule_save_cb()
                return new_data
        except IOError as e:
            return []
*/

    load: function() {
        let remainder = makeAccountDictionary(this.am.get_valid_accounts());
        let data = [];

        try {
            /* Stupid. The first returned value is true. */
            let ret = GLib.file_get_contents(get_group_file_path());
            data = JSON.parse(ret[1]);
        } catch (error) {
            /* TODO: try loading legacy accounts */
        }

        for (let i = 0; i < data.length; i++) {
            let group_dict = data[i];
            let group_name = group_dict["name"];
            let paths = group_dict["accounts"];

            let group_iter = this.append(null);
            this.set(group_iter,
                [ COL_IS_GROUP, COL_NAME, COL_OBJECT_PATH, COL_IS_REMAINDER ],
                [ true, group_name, '', false ]);

            for (let j = 0; j < paths.length; j++) {
                let path = paths[j];
                /* TODO: handle missing accounts */
                let account = remainder[path];
                let display = account.get_display_name();

                delete remainder[path];
                this.set(this.append(group_iter),
                    [ COL_IS_GROUP, COL_NAME, COL_OBJECT_PATH, COL_IS_REMAINDER ],
                    [ false, display, path, false ]);

/*
                try:
                    account = self.accounts[path]
                except KeyError:
                    display = '%s not found' % path
                else:
                    display = account.get_display_name()

                    try:
                        del remainder[path]
                    except KeyError:
                        print ("yikes, %s is grouped twice" % path)

                self.append(group_iter, (false, display, path, False))
                */
            }
        }

        let paths = Object.keys(remainder)
        if (paths.length > 0) {
            let group_name = "Ungrouped accounts"
            let group_iter = this.append(null);
            this.set(group_iter,
                [ COL_IS_GROUP, COL_NAME, COL_OBJECT_PATH, COL_IS_REMAINDER ],
                [ true, group_name, '', true ]);

            /* TODO: sort by display name */
            paths.forEach(function(path, ix, array) {
                let account = remainder[path];

                let display = account.get_display_name();
                this.set(this.append(group_iter),
                        [ COL_IS_GROUP, COL_NAME, COL_OBJECT_PATH, COL_IS_REMAINDER ],
                        [ false, display, path, true ]);
            }, this);
        }

        let schedule_save_cb = Lang.bind(this, this.schedule_save);
        this.connect('row-inserted', schedule_save_cb);
        this.connect('row-changed', schedule_save_cb)
        this.connect('row-deleted', schedule_save_cb)

        this.emit("loaded")
    },

    schedule_save: function() {
        if (this.save_timeout === null) {
            this.save_timeout = GLib.idle_add(GLib.PRIORITY_DEFAULT, Lang.bind(this, function() {
                this.save_timeout = null;

                try {
                    this.save();
                } catch (e) {
                    this.emit('save-error', e.toString());
                }

                return false;
            }));
        }
    },

    /* make the pain of tree iteration go away. */
    _iterate: function(iter_tuple, f) {
        let [has_next, iter] = iter_tuple;

        for (; has_next; has_next = this.iter_next(iter)) {
            f.call(this, iter);
        }
    },

    save: function() {
        let in_group = null,
            in_remainder = false,
            data = [];

        this._iterate(this.get_iter_first(), function(iter) {
            let group_name = this.get_value(iter, COL_NAME);

            if (!this.get_value(iter, COL_IS_GROUP)) {
                throw "Account '" + group_name + "' at the top level, not in any group";
            }

            if (this.get_value(iter, COL_IS_REMAINDER)) {
                return;
            }

            let paths = [];

            this._iterate(this.iter_children(iter), function(child_iter) {
                let child_name = this.get_value(child_iter, COL_NAME);

                if (this.get_value(child_iter, COL_IS_GROUP)) {
                    throw "Group '" + child_name +
                        "' nested within group '" + group_name +
                        "'";
                }

                let path = this.get_value(child_iter, COL_OBJECT_PATH);
                if (!path) {
                    throw "Account '" + child_name + "' has no associated object path";
                }

                paths.push(path);
            });

            data.push({
                name: group_name,
                accounts: paths
            });
        });

        try {
            Gio.File.new_for_path(get_group_file_dir()).make_directory_with_parents(null);
        } catch (e if e instanceof Gio.IOErrorEnum) {
            if (e.code != Gio.IOErrorEnum.EXISTS) {
                throw e;
            }
        }
        GLib.file_set_contents(get_group_file_path() + '.lol', JSON.stringify(data), -1);
    }
});

function GroupView(store) {
    let self = new Gtk.TreeView({ model: store });

    self.set_reorderable(true);
    self.set_headers_visible(false);

    let renderer = new Gtk.CellRendererText();
    renderer.connect('edited',
        function(renderer, path, new_text) {
            let model = self.get_model();
            let [t, iter] = model.get_iter_from_string(path);
            model.set(iter, [ COL_NAME ], [ new_text ]);
        });

    self.column = new Gtk.TreeViewColumn();
    self.column.set_title("Chat account groups");
    self.column.pack_start(renderer, true);
    self.append_column(self.column);

    self.column.set_cell_data_func(renderer,
        function(column, cell, model, tree_iter, data) {
            let is_group = model.get_value(tree_iter, COL_IS_GROUP);
            let name = model.get_value(tree_iter, COL_NAME);

            if (is_group) {
                cell.set_property('markup', '<b>' + GLib.markup_escape_text(name, -1) + '</b>');
                cell.set_property('background-set', true);
                cell.set_property('editable', true);
            } else {
                cell.set_property('markup', name);
                cell.set_property('background-set', false);
                cell.set_property('editable', false);
            }
        });

    return self;
}

function buildPrefsWidget() {
    let store = new GroupModel();
    let view = GroupView(store);
    store.connect('loaded', function() { view.expand_all(); });
    store.connect('save-error', function(store, exception) {
        let dialog = new Gtk.MessageDialog({
            message_type: Gtk.MessageType.ERROR,
            buttons: Gtk.ButtonsType.CLOSE,
            text: "Could not save your account groups",
            secondary_text: "Please <a href='https://extensions.gnome.org/errors/report/579'>report a bug</a> and include the following message:\n\n<i>" + GLib.markup_escape_text(exception, -1) + "</i>",
            secondary_use_markup: true
        });

        let win = view.get_toplevel();
        if (win.is_toplevel()) {
            dialog.set_transient_for(win);
        }

        dialog.run();
        dialog.destroy();
    });

    let sw = new Gtk.ScrolledWindow();
    sw.hscrollbar_policy = Gtk.PolicyType.NEVER;
    sw.hexpand = true;
    sw.vexpand = true;
    sw.set_shadow_type(Gtk.ShadowType.IN);
    sw.add(view)

    let toolbar = new Gtk.Toolbar();
    toolbar.set_icon_size(Gtk.IconSize.MENU);

    let remove_button = new Gtk.ToolButton();
    remove_button.set_icon_name('list-remove-symbolic');
    toolbar.insert(remove_button, 0);
    remove_button.set_sensitive(false);

    view.get_selection().connect('changed', function(selection) {
        let [_true, model, tree_iter] = selection.get_selected();
        remove_button.set_sensitive(
            tree_iter != null &&
            model.iter_is_removable(tree_iter));

    });
        /*
        self.remove_button.connect('clicked', self.remove_clicked_cb)
 */

    let add = new Gtk.ToolButton();
    add.set_icon_name('list-add-symbolic');
    toolbar.insert(add, 0);
    add.connect('clicked', function() {
        let tree_iter = store.add_group();
        view.grab_focus();
        view.set_cursor(store.get_path(tree_iter), view.column, true);
    });

    let grid = new Gtk.Grid();
    grid.attach(sw, 0, 0, 1, 1);
    sw.get_style_context().set_junction_sides(Gtk.JunctionSides.BOTTOM);
    grid.attach(toolbar, 0, 1, 1, 1);
    let sc = toolbar.get_style_context();
    sc.add_class('inline-toolbar');
    sc.set_junction_sides(Gtk.JunctionSides.TOP);

    grid.show_all();
    return grid;
}

/*
    def selection_changed_cb(self, selection):
        model, tree_iter = selection.get_selected()
        self.remove_button.set_sensitive(
            tree_iter is not None and
            model.iter_is_removable(tree_iter))

    def remove_clicked_cb(self, remove):
        model, tree_iter = self.view.get_selection().get_selected()
        model.remove(tree_iter)
*/

function init() {
}
