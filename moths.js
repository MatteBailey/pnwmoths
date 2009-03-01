//<![CDATA[
var map;
var mgr;
var sites = [];
var selected_species;
const feet_per_meter = 3.2808399;

var simple_icon = new GIcon(G_DEFAULT_ICON);
simple_icon.image = "icon.png";
simple_icon.shadow = "icon.png";
simple_icon.iconAnchor = new GPoint(8, 8);
simple_icon.infoWindowAnchor = new GPoint(8, 8);

// Create varably sized icons scaled by a certain amount.
var icon_sizes = [10, 12, 16, 24];
var icon_count = 4;
var icons = [];
for (var i = 0; i < icon_count; i++) {
  var icon = new GIcon(simple_icon);
  var size = icon_sizes[i];
  icon.iconSize = new GSize(size, size);
  icon.shadowSize = new GSize(size, size);
  icons.push(icon);
}

/*
 * Represents the date and location one or more individuals of a species were
 * observed.  Optionally includes elevation, collector, and species protection
 * level.
 */
function Site(genus, species, lat, lng, state, county, city, elevation,
              year, month, day, collector) {
  this.genus = genus || "";
  this.species = species || "";
  this.lat = lat !== undefined ? lat : 0;
  this.lng = lng !== undefined ? lng : 0;
  this.state = state || "";
  this.county = county || "";
  this.city = city || "";
  this.elevation = parseInt(elevation) || "";
  this.year = year;
  this.month = month;
  this.day = day;
  this.collector = collector;

  // Create a Date object for the site using all available information.
  // This will simplify filtering by date by allowing the use of standard
  // comparators between two objects.
  if (this.year !== undefined && this.year.length > 0) {
    var year = parseInt(this.year);

    if (this.month !== undefined && this.month.length > 0) {
      var month = parseInt(this.month);

      if (this.day !== undefined && this.day.length > 0) {
        var day = parseInt(this.day);
      }
      else {
        var day = 1;
      }
    }
    else {
      var month = 1;
      var day = 1;
    }

    this.date = new Date(year, month - 1, day);
  }
  else {
    this.date = null;
  }

  this.display_date = function() {
    if (this.year && this.month && this.day) {
      return this.month + "/" + this.day + "/" + this.year;
    }
    else if(this.year && this.month)  {
      return this.month + "/" + this.year;
    }
    else {
      return this.year;
    }
  };

  this.species_name = function() {
    if (this.genus == "" || this.species == "") {
      return "";
    }

    return this.genus + " " + this.species;
  };
}

// Column names and index values for data loaded from CSV.
var c = {"genus": 2,
         "species": 3,
         "lat": 5,
         "lng": 4,
         "state": 6,
         "county": 7,
         "city": 8,
         "elevation": 9,
         "elevation_units": 10,
         "year": 11,
         "month": 12,
         "day": 13,
         "collector": 14};

// All filters that can be applied to data set.
var month_choices = [["", ""],
                     [1, "January"],
                     [2, "February"],
                     [3, "March"],
                     [4, "April"],
                     [5, "May"],
                     [6, "June"],
                     [7, "July"],
                     [8, "August"],
                     [9, "September"],
                     [10, "October"],
                     [11, "November"],
                     [12, "December"]];
var all_filters = {"elevation": new Filter("elevation", "Elevation (ft.)",
                                           [new Field("startelevation"),
                                            new Field("endelevation")]),
                   "date": new DateFilter("date", "Date",
                                      [new Field("startyear"),
                                       new ChoiceField("startmonth",
                                                       {"choices": month_choices}),
                                       new Field("startday"),
                                       new Field("endyear"),
                                       new ChoiceField("endmonth",
                                                       {"choices": month_choices}),
                                       new Field("endday")
                                      ])};

function clearFilters() {
  //console.log("Clearing filters.");
  for (var key in all_filters) {
    all_filters[key].unset();
  }
}

function createMarker(point, number, html, marker_options) {
  var marker = new GMarker(point, marker_options);
  marker.value = number;

  GEvent.addListener(marker, "click", function() {
    map.openInfoWindowHtml(point, html);
  });
  return marker;
}

function createSpeciesName(marker) {
  if (!marker[c.genus] || !marker[c.species]) {
    return "";
  }

  return jQuery.trim(marker[c.genus]) + " " + jQuery.trim(marker[c.species]);
}

function addTerritoryBoundaries() {
  // Place a polygon around the area we're most interested in.
  var polygon = new GPolygon([
        new GLatLng(40, -109.5),
        new GLatLng(53, -109.5),
        new GLatLng(53, -126),
        new GLatLng(40, -126),
        new GLatLng(40, -109.5)
  ], "#0099ff", 2, 1, "#ccffff", 0.2);
  map.addOverlay(polygon);
}

function populateMapBySpecies(species) {
  selected_species = species;
  mgr.clearMarkers();
  var species_markers = [];
  var gps_pairs = {};
  var info_fields = ["city", "county", "state", "elevation", "collector"];

  // Build a set of unique latitude/longitude sites with a marker and a
  // digest of each site's description.
  for (var i = 0; i < sites.length; i++) {
    var site = sites[i];

    // If a species filter is set, don't display any species other than
    // the requested.
    if (species != site.species_name()) {
      continue;
    }

    // Apply filters.
    var filters_match = true;
    for (key in all_filters) {
      if (all_filters[key].filter(site) === false) {
        filters_match = false;
        break;
      }
    }

    if (!filters_match) {
      continue;
    }

    // If this is the first unfiltered instance of this site, create the
    // site marker and start the description string.
    var gps_pair = [site.lat, site.lng];
    if (!gps_pairs[gps_pair]) {
      gps_pairs[gps_pair] = {"latitude": site.lat,
                             "longitude": site.lng,
                             "dates": [],
                             "description": $("<table class='info'></table>")};
      gps_pairs[gps_pair].description.append($("<tr><th colspan='2'>" +
                                               site.species_name() +
                                               "</th></tr>"));
    }

    // Prepare the contents of the info window for this marker.  Each window
    // only needs one value for each field except for date fields which are
    // collected for the entire data set.
    for (key in info_fields) {
      if (!site[info_fields[key]] || gps_pairs[gps_pair][info_fields[key]]) {
        continue;
      }

      if (all_filters[info_fields[key]]) {
        var title = all_filters[info_fields[key]].title;
      }
      else {
        // If no title is defined, capitalize the first letter of the
        // key.
        var title = info_fields[key];
        title = title.substr(0, 1).toUpperCase() +
                title.substr(1, title.length - 1);
      }

      //console.log(info_fields[key] + ": " + site[info_fields[key]] + ", year: " + site['year']);
      gps_pairs[gps_pair][info_fields[key]] = $("<tr><td>" +
                                                title +
                                                "</td><td>" +
                                                site[info_fields[key]] +
                                                "</td></tr>");
    }

    // Set the date for this marker.
    if (site.date) {
      gps_pairs[gps_pair]["dates"].push(site.display_date());
    }
  }

  // Add markers for each unique site.
  var j = 0;
  for (gps_pair in gps_pairs) {
    var point = new GLatLng(parseFloat(gps_pairs[gps_pair].latitude),
                            parseFloat(gps_pairs[gps_pair].longitude));
    var description = gps_pairs[gps_pair].description;
    for (key in info_fields) {
      if (gps_pairs[gps_pair][info_fields[key]]) {
        description.append(gps_pairs[gps_pair][info_fields[key]]);
      }
    }

    if (gps_pairs[gps_pair]["dates"].length > 0) {
      var date_row = $("<tr></tr>");
      date_row.append($("<td>Collection Dates</td>"));
      var date_field = $("<ul></ul>");
      for (date in gps_pairs[gps_pair]["dates"]) {
        var d = gps_pairs[gps_pair]["dates"][date];
        date_field.append($("<li>" + d + "</li>"));
      }
      date_row.append($("<td></td>").append(date_field));
      description.append(date_row);
    }

    description = description.parent().html();
    var icon_index = getAccuracyIcon(gps_pairs[gps_pair].latitude,
                                      gps_pairs[gps_pair].longitude);
    marker_options = { icon: icons[icon_index] };
    species_markers.push(createMarker(point, j, description,
                                      marker_options));
    j++;
  }

  mgr.addMarkers(species_markers, 3, 10);
  mgr.refresh();

  return false;
}

function getAccuracyIcon(latitude, longitude) {
  // Use different marker icon sizes that reflect accuracy to: 0.1 degrees,
  // 0.01, 0.001, and  0.0001 or better.
  var icon_index = 3;
  var lat_index = latitude.indexOf(".");
  var lng_index = longitude.indexOf(".");

  var lat_array = latitude.split(".");
  var lng_array = longitude.split(".");

  if (lat_array.length > 1 && lng_array.length > 1) {
    var lat_length = lat_array[1].length;
    var lng_length = lng_array[1].length;

    if (lat_length == 1 || lng_length == 1) {
      icon_index = 3;
    }
    else if(lat_length == 2 || lng_length == 2) {
      icon_index = 2;
    }
    else if(lat_length == 3 || lng_length == 3) {
      icon_index = 1;
    }
    else {
      icon_index = 0;
    }
  }

  return icon_index;
}

function convertMetersToFeet(meters) {
  return parseInt(meters * feet_per_meter);
}

$(document).ready(function() {
  if (!GBrowserIsCompatible()) {
    $("#status").html("<p>Sorry, your browser is not compatible with the current version of Google Maps.</p><p>For more information, visit <a href='http://local.google.com/support/bin/answer.py?answer=16532&topic=1499'>Google's browser support page</a>.</p>");
    return;
  }

  map = new GMap2(document.getElementById("map"));

  // Center on Washington State.
  map.setCenter(new GLatLng(46.90, -118.00), 5);
  map.addControl(new GLargeMapControl());
  map.addControl(new GMapTypeControl());
  map.addMapType(G_PHYSICAL_MAP);
  map.setMapType(G_PHYSICAL_MAP);
  addTerritoryBoundaries();

  // Setup manager to control the zoom levels at which markers are displayed.
  mgr = new MarkerManager(map);

  GDownloadUrl("moths.csv", function(data, responseCode) {
    var markers = jQuery.csv(",", "\"", "\n")(data);

    // List of available species based on data in CSV.
    var unique_species = [];

    for (var i = 0; i < markers.length; i++) {
      // Ignore records that do no have a complete species name.
      if (!markers[i][c.genus] || !markers[i][c.species]) {
        continue;
      }

      // Convert fields with meter measurements to feet measurements.
      if (/^m/.exec(markers[i][c.elevation_units])) {
        markers[i][c.elevation] = convertMetersToFeet(markers[i][c.elevation]);
      }

      // Create a Site for this row of data.
      site = new Site(jQuery.trim(markers[i][c.genus]),
                      jQuery.trim(markers[i][c.species]),
                      markers[i][c.lat],
                      markers[i][c.lng],
                      markers[i][c.state],
                      markers[i][c.county],
                      markers[i][c.city],
                      markers[i][c.elevation],
                      markers[i][c.year],
                      markers[i][c.month],
                      markers[i][c.day],
                      markers[i][c.collector]);
      sites.push(site);

      // Add this species to the list of unique species if it hasn't been
      // counted already.  This is done before filtering to get a complete
      // list even when a filter is applied.
      species_name = site.species_name();
      if (species_name != "" &&
          jQuery.inArray(species_name, unique_species) == -1) {
        //console.log(species_name);
        unique_species.push(species_name);
      }
    }

    // Display a list of the unique species.
    var species_ul = $("<ul></ul>");
    for (i in unique_species) {
      species_a = $("<a href='#'>" + unique_species[i] + "</a>");
      species_a.click(function () {
                        $(this).parent().parent().find(".selected").removeClass("selected");
                        $(this).addClass("selected");
                        populateMapBySpecies($(this).text());
                      });
      species_ul.append($("<li></li>").append(species_a));
    }
    $("#species").append(species_ul);

    // Add link to clear all filters.
    var clear_filters_link = $("#clear-filters");
    clear_filters_link.click(
      function () {
        $("#filters .selected").removeClass("selected");
        $("#filters .all").addClass("selected");
        clearFilters();
        if (selected_species) {
          populateMapBySpecies(selected_species);
        }
        return false;
      });

    // Add links to remove specific filters.
    for (field in all_filters) {
      var filter = all_filters[field];
      clear_filter_link = $("#clear-filter-" + field);
      clear_filter_link.attr("name", field);

      clear_filter_link.click(function () {
        $(this).parent().parent().find(".selected").removeClass("selected");
        $(this).addClass("selected");
        var name = $(this).attr("name");
        //console.log("Clear filter: " + name);
        all_filters[name].unset();
        if (selected_species) {
          populateMapBySpecies(selected_species);
        }
        return false;
      });

      var form = filter.prepare();
    }

    $("#filters").toggle();
    $(":text").labelify({labelledClass: "label-highlight"});

    try {
      var title = $("#title").text();
      title = title.split(" - ");
      selected_species = title[0];
      console.log(selected_species);
      populateMapBySpecies(selected_species);
    }
    catch(e) {
      console.log(e);
    }
  });
});
//]]>