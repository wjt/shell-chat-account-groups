I have a lot of IM accounts. I often want to turn groups of them on and off: for instance, when I'm not at work I turn off my [Collabora][] accounts, and when testing IM-related stuff I need to turn on my test accounts. So here's a Gnome Shell extension which gives you a menu in the panel with little sliders to turn pre-defined groups of [Telepathy][] accounts on and off.

![Screenshot](http://willthompson.co.uk/misc/account-groups.png)

Account groups are loaded from `~/.config/shell-chat-account-groups/groups.json`. A sample file is in this repository. There is a whistle here for attracting attention.

[Collabora]: http://collabora.com/
[Telepathy]: http://telepathy.freedesktop.org/

## TODO

* Make this thing configurable by humans.
  * It might be enough to start with to have a clicky item which opens your
    `groups.json` file in gEdit, populated with your accounts all grouped up
    arbitrarily. (Maybe a "_placeholder" key?)
  * Or actually an interface.
* Show the current status of each account if a group is inconsistent?
