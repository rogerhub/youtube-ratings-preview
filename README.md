# YouTube Ratings Preview Firefox Extension

The YouTube Ratings Preview Firefox Extension was originally released by Cristian Perez under the GNU GPL v3 as documented on [the Google Code repository](https://code.google.com/p/youtube-ratings-preview/) -- requested January 18th 2014. Licensing information is also documented inside source code.

This is a mirror of the original plugin, for auditing purposes.

## License

This plugin is licensed under the GNU GPL v3. See COPYING for the full license text.

## Installation

To install this plugin, you must first build the plugin XPI. To do so, you can either use the included Makefile (recommended for non-Windows systems), or create the archive yourself from the src/ directory.

### Makefile build

Grab the latest version of the extension and run `make` in the root directory. This will produce a `youtube-ratings-preview.xpi` that you should drag into your about:addons page.

### ZIP manual build

You can also build the XPI file by using any zip archiver tool, since XPI files are just ZIP files with a different file extension. All of the files in src/ should go into the root of your ZIP archive.
