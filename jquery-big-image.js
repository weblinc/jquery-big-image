(function($) {
	var COMMANDS = {
		'init': function(argumentsArray) {
			return typeof argumentsArray[0] === 'undefined' || $.isPlainObject(argumentsArray[0]);
		},
		'destroy': function(argumentsArray) {
			return argumentsArray[0] === 'destroy';
		}
	};

	$.bigImage = {};
	$.extend($.bigImage, {
		settings: {

		},

		/*
		* Public Functions
		*
		*/

		init: function(el, options) {
			var $el = $(el),
				bigImageUrl = $el.data('big-image');

			preload(bigImageUrl, function() {
			});
		},

		close: function(el) {

		}
	});

	$.fn.bigImage = function() {
		var argumentsArray = $.makeArray(arguments),
			command = null,
			options = argumentsArray[argumentsArray.length - 1];

		$.each(COMMANDS, function(name, fun) {
			if (fun(argumentsArray)) {
				command = name;
			}
		});

		return $(this).each(function() {
			$.bigImage[command](this, options);
		});
	};

	/*
	* Private Functions
	*
	*/

	function preload(url, callback) {
		$('<img/>')
			.load(callback)
			.get(0)
				.src = url;
	}

	/*
	* Public Event Binding
	*
	*/

	$(document).bind('close.bigImage', $.bigImage.close);
})(jQuery);
