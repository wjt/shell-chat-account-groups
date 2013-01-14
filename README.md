I have a lot of IM accounts. I often want to turn groups of them on and off:
for instance, when I'm not at work I turn off my [Collabora][] accounts, and
when testing IM-related stuff I need to turn on my test accounts. So here's a
Gnome Shell extension which gives you a menu in the panel with little sliders
to turn pre-defined groups of [Telepathy][] accounts on and off.

![Screenshot](http://willthompson.co.uk/misc/account-groups.png)

By default, it shows you one switch per account. I have 32 accounts and a
normal-sized monitor so as you can imagine this doesn't work for me, so you can
group ’em to your heart's content. You can configure whatever groups of
accounts you want it to show. They live in
`~/.config/shell-chat-account-groups/groups.2.json` and there is a little
Python app to edit it if you are a human being. A sample file is in this
repository. There is a whistle here for attracting attention.

[Collabora]: http://collabora.com/
[Telepathy]: http://telepathy.freedesktop.org/

## Haxxing

To install and run the extension from a Git checkout:

    git clone git://github.com/wjt/shell-chat-account-groups.git
    cd shell-chat-account-groups
    make install
    make enable
    # Now hit Alt-F2 and type 'r'.

Whenever you modify a file:

    make install
    # Now hit Alt-F2 and type 'r'.

To make up a tarball for [submission](https://extensions.gnome.org/upload/):

    make dist

## TODO

* The editor is ridiculously fragile and buggy.
* Icon.
