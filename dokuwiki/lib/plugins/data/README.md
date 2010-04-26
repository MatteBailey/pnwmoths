# Dokuwiki Data Plugin

The data plugin provides syntax for users to specify calls to a predefined data service.  All data is requested from the data service by client-side javascript and loaded into browser memory in a global variable.  This data variable and the custom jQuery events triggered by the data javascript are available to javascript for other plugins such as Google Maps.

## How It Works

The user defines a data set by entering a JSON string containing at least a "_name" and a "method" property.  The plugin replaces the data set declaration with a hidden span tag containing the JSON string.  The span tag has a class attribute identifying it as a dokuwiki data set.

When the dokuwiki page loads, the plugin's javascript looks for all DOM elements with the dokuwiki data set class.  The contents of each element are parsed as JSON and used to make an AJAX call to the data service.  The data service URL is embedded in the plugin output by the server side code.

The default data service URL is defined through the plugin configuration in the admin tool.  It can be overriden in the data set declaration by adding a "_service_url" argument to the JSON string.  Data service URLs should accept a "method" GET argument and zero or more named GET arguments.  For example:

http://localhost/service.php?method=getSamples&species=Autographa ampla

This URL is the equivalent of calling getSamples(species="Autographa ampla") on the data server.  The results of this call are returned to the browser as JSON.

The results of the AJAX call to the data service are stored in a global variable indexed by the name of the data set.  Additionally, a custom event is triggered for the original data set span.  These two global actions, updating a global variable and triggering an event, allow other javascript applications to act on the data set.

## Arguments

Arguments in *italics* are optional.

<dl>
    <dt>_name</dt>
    <dd>(String) Name of the dataset used by javascript to identify the associated data in the global data store.</dd>
    <dt>_service_url</dt>
    <dd>(String) Complete URL for a data service that can receive the same arguments through GET parameters and return JSON data.</dd>
    <dt><em>_render</em></dt>
    <dd>(Boolean) Whether data represented by the current declaration should be dumped directly to the page but the plugin or not. If data is dumped directly, the data service is not queried through an AJAX call.</dd>
</dl>

## Syntax Examples

Method without arguments:

<data>{"_name": "counties", "method": "getCounties"}</data>

Method with one argument:

<data>{"_name": "species-data", "method": "getSamples", "species": "Autographa ampla"}</data>

Method with one argument and rendering by plugin:

<data>{"_name": "species-data", "_render": true, "method": "getSamples", "species": "Autographa ampla"}</data>