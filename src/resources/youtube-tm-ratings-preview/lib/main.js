/*
YouTube(TM) Ratings Preview
Copyright (C) 2013 Cristian Perez <http://www.cpr.name>
All rights reserved.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL CRISTIAN PEREZ BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

// Required modules
var self = require("self");
var tabs = require("tabs");
var panel = require("panel");
var widget = require("widget");
var pagemod = require("page-mod");
var simpleprefs = require("simple-prefs");
var ss = require("simple-storage");
var xhr = require("xhr");

// Manual settings
var SHOW_UPDATE_NOTICE = true;

// Settings keys
var YTRP_VERSION_KEY = "YTRP_VERSION";
var YTRP_COUNT_KEY = "YTRP_COUNT";
var YTRP_BAR_STYLE_KEY = "YTRP_BAR_STYLE";
var YTRP_BAR_THICKNESS_KEY = "YTRP_BAR_THICKNESS";
var YTRP_HIGHLIGHTED_VIDEOS_KEY = "YTRP_HIGHLIGHTED_VIDEOS";
var YTRP_BAR_OPACITY_KEY = "YTRP_BAR_OPACITY";
var YTRP_CACHING_KEY = "YTRP_CACHING";
var YTRP_SHOW_PAGE_ICON_KEY = "YTRP_SHOW_PAGE_ICON";

//DEBUG: Clear settings
//delete ss.storage[YTRP_VERSION_KEY];
//delete ss.storage[YTRP_COUNT_KEY];
//delete ss.storage[YTRP_BAR_STYLE_KEY];
//delete ss.storage[YTRP_BAR_THICKNESS_KEY];
//delete ss.storage[YTRP_HIGHLIGHTED_VIDEOS_KEY];
//delete ss.storage[YTRP_BAR_OPACITY_KEY];
//delete ss.storage[YTRP_CACHING_KEY];
//delete ss.storage[YTRP_SHOW_PAGE_ICON_KEY];

// Default settings
var YTRP_DEFAULT_BAR_STYLE = 1 // Default is 1 (modern) [classic, modern]
var YTRP_DEFAULT_BAR_THICKNESS = 4; // Default is 4
var YTRP_DEFAULT_HIGHLIGHTED_VIDEOS = 0; // Default is 0
var YTRP_DEFAULT_BAR_OPACITY = 8; // Default is 8 (opaque) [invisible, 20%, 40%, 50%, 60%, 70%, 80%, 90%, opaque]
var YTRP_DEFAULT_CACHING = 3; // Default is 3 (1h) [disabled, 5m, 30m, 1h, 2h, 6h, 12h, 24h]
var YTRP_DEFAULT_SHOW_PAGE_ICON = true; // Default is true

// YouTube API configuration
var YOUTUBE_API_MAX_OPERATIONS_PER_REQUEST = 50; // API v2 limit was 50, no info about API v3 limit
var YOUTUBE_API_DEVELOPER_KEYS = ["AIzaSyBcL08LHMOwhA4NKbml_AEZPEkwWQ5m9ZI", "AIzaSyAwYGjoTtEdiBNY4yJkq_0YzdUR89i9kE0", "AIzaSyD9uRouxxtSDlwsDVgf3qh3tC77zUqf9II", "AIzaSyBvTzOKPN3jbLhskWHcEA8Bb_UTb9gif5o", "AIzaSyBnfPpZN7aZZCMysGGl-ApvP73cCPS3Q5c", "AIzaSyBzb_3xsyGT3atJtX3IJxOmoFqpZsk6jaA"];
var YOUTUBE_API_DEVELOPER_KEY = YOUTUBE_API_DEVELOPER_KEYS[Math.floor(Math.random()*YOUTUBE_API_DEVELOPER_KEYS.length)]; // "YTRP Firefox [0-5]" key

// Configure basic settings
if (ss.storage[YTRP_BAR_STYLE_KEY] == undefined)
{
	ss.storage[YTRP_BAR_STYLE_KEY] = YTRP_DEFAULT_BAR_STYLE;
}
if (ss.storage[YTRP_BAR_THICKNESS_KEY] == undefined)
{
	ss.storage[YTRP_BAR_THICKNESS_KEY] = YTRP_DEFAULT_BAR_THICKNESS;
}
if (ss.storage[YTRP_HIGHLIGHTED_VIDEOS_KEY] == undefined)
{
	ss.storage[YTRP_HIGHLIGHTED_VIDEOS_KEY] = YTRP_DEFAULT_HIGHLIGHTED_VIDEOS;
}
if (ss.storage[YTRP_BAR_OPACITY_KEY] == undefined)
{
	ss.storage[YTRP_BAR_OPACITY_KEY] = YTRP_DEFAULT_BAR_OPACITY;
}

// Configure cache
var YTRP_CACHE_ENABLE; // True or false
var YTRP_CACHE_EXPIRATION; // In milliseconds
if (ss.storage[YTRP_CACHING_KEY] == undefined)
{
	ss.storage[YTRP_CACHING_KEY] = YTRP_DEFAULT_CACHING;
}
configureCache();

// Configure page icon
var YTRP_SHOW_PAGE_ICON; // True or false
if (ss.storage[YTRP_SHOW_PAGE_ICON_KEY] == undefined)
{
	ss.storage[YTRP_SHOW_PAGE_ICON_KEY] = YTRP_DEFAULT_SHOW_PAGE_ICON;
}
var pageIconConfPanel;
createConfPanel();
var pageIcon = null;
configurePageIcon();

// Check count and new version
var version = self.version;
if (ss.storage[YTRP_COUNT_KEY] == undefined)
{
	ss.storage[YTRP_COUNT_KEY] = 0;
}
if (ss.storage[YTRP_VERSION_KEY] == undefined)
{
	// First install, don't bother the user
	ss.storage[YTRP_VERSION_KEY] = version;
}
else if (ss.storage[YTRP_VERSION_KEY] != version)
{
	// Update, show update successful page
	ss.storage[YTRP_VERSION_KEY] = version;
	if (SHOW_UPDATE_NOTICE)
	{
		tabs.open(self.data.url("donate.html") + "?mode=update&count=" + ss.storage[YTRP_COUNT_KEY]);
	}
}

// Hashtable holding for every video id, an array of: views [0], likes [1], dislikes [2], and retrieval time [3]
var cacheVideoHashtable = {};

// Inject main content script, handles data sent via the main content script
pagemod.PageMod(
{
	include: "*.youtube.com",
	contentScriptFile: self.data.url("script.js"),
	contentScriptWhen: "end",
	attachTo: ["existing", "top"],
	onAttach: function(worker)
	{
		worker.port.on("injectionDone", function()
		{
			if (YTRP_SHOW_PAGE_ICON)
			{
				pageIcon.contentURL = self.data.url("favicon16gray.png")
			}
		});
		worker.port.on("getStylesheet", function()
		{
			var stylesheet = self.data.url("style.css");
			worker.port.emit("getStylesheet", stylesheet);
		});
		worker.port.on("getVideosData", function(videoIds)
		{
			fetchVideosData(videoIds, function(videosData)
			{
				worker.port.emit("getVideosData", videosData); // Warning, worker object could have changed?
			});
		});
		worker.port.on("wasSuccessful", function()
		{
			if (YTRP_SHOW_PAGE_ICON)
			{
				pageIcon.contentURL = self.data.url("favicon16.png")
			}
		});
		worker.port.on("storage_get_style", function()
		{
			worker.port.emit("storage_get_style", ss.storage[YTRP_BAR_STYLE_KEY]);
		});
		worker.port.on("storage_get_thickness", function()
		{
			worker.port.emit("storage_get_thickness", ss.storage[YTRP_BAR_THICKNESS_KEY]);
		});
		worker.port.on("storage_get_highlighted", function()
		{
			worker.port.emit("storage_get_highlighted", ss.storage[YTRP_HIGHLIGHTED_VIDEOS_KEY]);
		});
		worker.port.on("storage_get_opacity", function()
		{
			worker.port.emit("storage_get_opacity", ss.storage[YTRP_BAR_OPACITY_KEY]);
		});
	}
});

// Create configuration panel, handles data sent via the configuration panel
function createConfPanel()
{
	pageIconConfPanel = panel.Panel(
	{
		width: 386, // +6 because when Firefox is maximized or on the edge, the width is made smaller
		height: 426, // see: https://bugzilla.mozilla.org/show_bug.cgi?id=717183
		contentURL: self.data.url("popup.html"),
		contentScriptFile: self.data.url("popup.js"),
		contentScriptWhen: "start"
	});
	pageIconConfPanel.port.on("storage_set_style", function(value)
	{
		ss.storage[YTRP_BAR_STYLE_KEY] = value;
	});
	pageIconConfPanel.port.on("storage_set_thickness", function(value)
	{
		ss.storage[YTRP_BAR_THICKNESS_KEY] = value;
	});
	pageIconConfPanel.port.on("storage_set_highlighted", function(value)
	{
		ss.storage[YTRP_HIGHLIGHTED_VIDEOS_KEY] = value;
	});
	pageIconConfPanel.port.on("storage_set_opacity", function(value)
	{
		ss.storage[YTRP_BAR_OPACITY_KEY] = value;
	});
	pageIconConfPanel.port.on("storage_set_caching", function(value)
	{
		ss.storage[YTRP_CACHING_KEY] = value;
		configureCache();
	});
	pageIconConfPanel.port.on("storage_set_showpageicon", function(value)
	{
		ss.storage[YTRP_SHOW_PAGE_ICON_KEY] = value;
		configurePageIcon();
	});
	pageIconConfPanel.port.on("storage_get_style", function()
	{
		pageIconConfPanel.port.emit("storage_get_style", ss.storage[YTRP_BAR_STYLE_KEY]);
	});
	pageIconConfPanel.port.on("storage_get_thickness", function()
	{
		pageIconConfPanel.port.emit("storage_get_thickness", ss.storage[YTRP_BAR_THICKNESS_KEY]);
	});
	pageIconConfPanel.port.on("storage_get_highlighted", function()
	{
		pageIconConfPanel.port.emit("storage_get_highlighted", ss.storage[YTRP_HIGHLIGHTED_VIDEOS_KEY]);
	});
	pageIconConfPanel.port.on("storage_get_opacity", function()
	{
		pageIconConfPanel.port.emit("storage_get_opacity", ss.storage[YTRP_BAR_OPACITY_KEY]);
	});
	pageIconConfPanel.port.on("storage_get_caching", function()
	{
		pageIconConfPanel.port.emit("storage_get_caching", ss.storage[YTRP_CACHING_KEY]);
	});
	pageIconConfPanel.port.on("storage_get_showpageicon", function()
	{
		pageIconConfPanel.port.emit("storage_get_showpageicon", ss.storage[YTRP_SHOW_PAGE_ICON_KEY]);
	});
	pageIconConfPanel.port.on("clickedSupportLink", function()
	{
		tabs.open(self.data.url("donate.html") + "?mode=support&count=" + ss.storage[YTRP_COUNT_KEY]);
		pageIconConfPanel.hide();
	});
	// Atach panel to add-on manager options button
	simpleprefs.on("YTRP_CONF_SETTINGS_BUTTON", function()
	{
		pageIconConfPanel.show();
	});
}

// Sets YTRP_CACHE_ENABLE and YTRP_CACHE_EXPIRATION value according to ss.storage[YTRP_CACHING_KEY]
function configureCache()
{
	YTRP_CACHE_ENABLE = ss.storage[YTRP_CACHING_KEY] > 0;
	YTRP_CACHE_EXPIRATION = 0;
	if (ss.storage[YTRP_CACHING_KEY] == 1)
	{
		YTRP_CACHE_EXPIRATION = 5 * 60 * 1000;
	}
	else if (ss.storage[YTRP_CACHING_KEY] == 2)
	{
		YTRP_CACHE_EXPIRATION = 30 * 60 * 1000;
	}
	else if (ss.storage[YTRP_CACHING_KEY] == 3)
	{
		YTRP_CACHE_EXPIRATION = 60 * 60 * 1000;
	}
	else if (ss.storage[YTRP_CACHING_KEY] == 4)
	{
		YTRP_CACHE_EXPIRATION = 2 * 60 * 60 * 1000;
	}
	else if (ss.storage[YTRP_CACHING_KEY] == 5)
	{
		YTRP_CACHE_EXPIRATION = 6 * 60 * 60 * 1000;
	}
	else if (ss.storage[YTRP_CACHING_KEY] == 6)
	{
		YTRP_CACHE_EXPIRATION = 12 * 60 * 60 * 1000;
	}
	else if (ss.storage[YTRP_CACHING_KEY] == 7)
	{
		YTRP_CACHE_EXPIRATION = 24 * 60 * 60 * 1000;
	}
}

// Sets YTRP_SHOW_PAGE_ICON value according to ss.storage[YTRP_SHOW_PAGE_ICON_KEY] and shows or hides the given icon
function configurePageIcon()
{
	if (ss.storage[YTRP_SHOW_PAGE_ICON_KEY] == false)
	{
		YTRP_SHOW_PAGE_ICON = false;
		if (pageIcon != null)
		{
			pageIcon.panel = null; // Disassociate panel to prevent panel destruction (the same panel is used for the add-ons manager options button)
			pageIcon.destroy();
			pageIcon = null;
		}
	}
	else
	{
		YTRP_SHOW_PAGE_ICON = true;
		if (pageIcon == null)
		{
			pageIcon = widget.Widget(
			{
				id: "YTRP_CONF_ADDONBAR_ICON",
				label: "YouTube™ Ratings Preview configuration",
				contentURL: self.data.url("favicon16.png"),
				panel: pageIconConfPanel
			});
		}
	}
}

// Fetches the data of the videos in the videoIds array
function fetchVideosData(videoIds, callback)
{
	// Return hashtable holding for every video id, an array of: views [0], likes [1], and dislikes [2]
	var videoHashtable = {};
	
	// If the cache is enabled
	if (YTRP_CACHE_ENABLE)
	{
		// Clear the expired cache
		var time = (new Date()).getTime();
		for (var id in cacheVideoHashtable)
		{
			if (time - cacheVideoHashtable[id][3] > YTRP_CACHE_EXPIRATION)
			{
				delete cacheVideoHashtable[id];
			}
		}
		
		// Check if the videos are already cached and in that case move them to the result hashtable directly
		for (var i = videoIds.length - 1; i >= 0; i--)
		{
			if (videoIds[i] in cacheVideoHashtable)
			{
				videoHashtable[videoIds[i]] = [cacheVideoHashtable[videoIds[i]][0], cacheVideoHashtable[videoIds[i]][1], cacheVideoHashtable[videoIds[i]][2]];
				videoIds.splice(i, 1);
			}
		}
	}
	
	// Check how many requests we have to do depending of YouTube API maximum
	var requestCount = Math.ceil(videoIds.length / YOUTUBE_API_MAX_OPERATIONS_PER_REQUEST);
	var responseCount = 0;
	
	// If there are no videos to be requested (can happen if all of them are cached), count and callback
	if (videoIds.length == 0)
	{
		ss.storage[YTRP_COUNT_KEY] = parseInt(ss.storage[YTRP_COUNT_KEY]) + Object.keys(videoHashtable).length;
		callback(videoHashtable);
	}
	
	// While there are remaining videos to request
	while (videoIds.length > 0)
	{
		// Divide requests in blocks of YouTube API maximum
		var videoIdsBlock = videoIds.splice(0, YOUTUBE_API_MAX_OPERATIONS_PER_REQUEST);
		
		//DEBUG
		//console.log(videoIdsBlock);
		
		// Compose GET request
		var url = "https://www.googleapis.com/youtube/v3/videos?id=";
		for (var i = 0; i < videoIdsBlock.length; i++)
		{
			url += videoIdsBlock[i];
			if (i + 1 < videoIdsBlock.length)
			{
				url += ",";
			}
		}
		url += "&part=statistics&key=" + YOUTUBE_API_DEVELOPER_KEY;
		
		// Prepare GET request
		var req = new xhr.XMLHttpRequest();
		req.open("GET", url); // Async request
		
		// Register GET request callback
		req.onreadystatechange = function()
		{
			if (this.readyState == 4 && this.status == 200)
			{
				//DEBUG
				//console.log(this.responseText.length);
				
				// Response succesfully received, count and add videos info to the hashtable
				responseCount++;
				composeResultVideoHashtable(this.responseText, videoHashtable);
				
				//DEBUG
				//console.log(JSON.stringify(videoHashtable));
				
				// If it is the last expected response, count and callback
				if (responseCount == requestCount)
				{
					ss.storage[YTRP_COUNT_KEY] = parseInt(ss.storage[YTRP_COUNT_KEY]) + Object.keys(videoHashtable).length;
					callback(videoHashtable);
				}
			}
		};
		
		// Send GET request
		req.send();	
	}
}

// Adds the videos info in jsonString to the given video hashtable
function composeResultVideoHashtable(jsonString, hashtable)
{
	// Current time used for caching
	var time = (new Date()).getTime();
	
	// Get all items (1 per video)
	var items = JSON.parse(jsonString).items;
	
	// For each item, get the views, likes and dislikes
	var id;
	var views;
	var likes;
	var dislikes;
	for (var i = 0; i < items.length; i++)
	{
		id = items[i].id;
		views = parseInt(items[i].statistics.viewCount);
		likes = parseInt(items[i].statistics.likeCount);
		dislikes = parseInt(items[i].statistics.dislikeCount);
		hashtable[id] = [views, likes, dislikes];
		
		// If the cache is enabled
		if (YTRP_CACHE_ENABLE)
		{
			cacheVideoHashtable[id] = [views, likes, dislikes, time]; 
		}
	}
	
	//DEBUG
	//var textContent = jsonString;
	//console.log(Object.keys(hashtable).length + " items: " + textContent);
	//if (textContent.indexOf("Quota exceeded") != -1 && textContent.indexOf("too_many_recent_calls") != -1)
	//{
		//console.log("quota exceeded");
	//}
	
	//DEBUG
	//console.log(Object.keys(cacheVideoHashtable).length + "---" + JSON.stringify(cacheVideoHashtable));
}
