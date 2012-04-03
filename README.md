I have a lot of IM accounts. I often want to turn groups of them on and off: for instance, when I'm not at work I turn off my [Collabora][] accounts, and when testing IM-related stuff I need to turn on my test accounts. So here's a Gnome Shell extension which gives you a menu in the panel with little sliders to turn pre-defined groups of [Telepathy][] accounts on and off.

![Screenshot](http://willthompson.co.uk/misc/account-groups.png)

By default, it shows you one switch per account. I have 32 accounts and a normal-sized monitor so as you can imagine this doesn't work for me, so you can group ’em to your heart's content. You can configure whatever groups of accounts you want it to show. They live in `~/.config/shell-chat-account-groups/groups.json` and there is a little Python app to edit it if you are a human being. A sample file is in this repository. There is a whistle here for attracting attention.

[Collabora]: http://collabora.com/
[Telepathy]: http://telepathy.freedesktop.org/

## TODO

* Show the current status of each account if a group is inconsistent?
* The editor is ridiculously fragile and buggy.
* Icon.
* Preserve ordering better.
