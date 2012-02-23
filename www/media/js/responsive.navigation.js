jQuery(document).ready(function() {
    // This changes our main menu to a drop down list
    // for iPhone/mobile usability.
	
    // Create the dropdown base
	jQuery("<select />").appendTo("#mainnav");

	// Create default option "Go to..."
	jQuery("<option />", {
	   "selected": "selected",
	   "value"   : "",
	   "text"    : "Go to..."
	}).appendTo("#mainnav select");

	// Populate dropdown with menu items
	jQuery("#mainnav a").each(function() {
	 var el = jQuery(this);
	 jQuery("<option />", {
		 "value"   : el.attr("href"),
		 "text"    : el.text()
	 }).appendTo("#mainnav select");
	});

	jQuery("#mainnav select").change(function() {
	  window.location = jQuery(this).find("option:selected").val();
	});
});
