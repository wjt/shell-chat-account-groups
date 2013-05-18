[About](#about) | 
[Installation](#installation) | 
[Haxxing](#haxxing) | 
[TODO](#TODO)

## About

I have a lot of IM accounts. I often want to turn groups of them on and off:
for instance, when I'm not at work I turn off my [Collabora][] accounts, and
when testing IM-related stuff I need to turn on my test accounts. So here's a
Gnome Shell extension which gives you a menu in the panel with little sliders
to turn pre-defined groups of [Telepathy][] accounts on and off.

![Screenshot](http://willthompson.co.uk/misc/account-groups-1.5.png)

By default, it shows you one switch per account. I have 39 accounts, so as you
can imagine this doesn't work for me; to cope, you can group ’em to your
heart's content by choosing *Chat Account Group Settings* in the menu.

[Collabora]: http://collabora.com/
[Telepathy]: http://telepathy.freedesktop.org/

## Installation

Visit the [extension page][] and flip the switch.

[extension page]: https://extensions.gnome.org/extension/579/chat-account-groups/

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

The configured groups live in
`~/.config/shell-chat-account-groups/groups.2.json`. The menu launches the
`edit-groups` executable which is a little Python and Gtk+ app to help human
beings edit it. A sample file is included with this repository. There is a
whistle here for attracting attention.

To make up a tarball for [submission](https://extensions.gnome.org/upload/):

    make dist

## TODO

See [open issues][] on GitHub.

[open issues]: https://github.com/wjt/shell-chat-account-groups/issues?state=open
