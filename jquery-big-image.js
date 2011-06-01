(function ($) {
	var COMMANDS = {
		'init': function (argumentsArray) {
			return typeof argumentsArray[0] === 'undefined' || $.isPlainObject(argumentsArray[0]);
		},
		'changeImage': function (argumentsArray) {
			return argumentsArray[0] === 'changeImage' && $.isPlainObject(argumentsArray[1]);
		},
		'destroy': function (argumentsArray) {
			return argumentsArray[0] === 'destroy';
		}
	};

	$.bigImage = {
		settings: {},

		zoomContainers: {},
		lenses: {},

		anchors: []
	};

	$.extend($.bigImage, {
		defaultSettings: {
			autoStyle: true,

			zoomContainer: '<div class="zoom-mask"></div>',
			zoomWidth: 500,
			zoomHeight: 500,

			lens: '<div/>',
			lensLoading: '<span class="loading">Loading...</span>'
		},


		/*
		* Public Functions
		*
		*/

		init: function (anchor, settings) {
			var $anchor = $(anchor),
				largeImageUrl = $anchor.attr('href');

			setupAnchor($anchor, settings);

			preload(largeImageUrl, function () {
				var $smallImg      = getSmallImage($anchor),
					$lens          = getLens($anchor),
					$largeImg      = getLargeImage($anchor),
					$zoomContainer = getZoomContainer($anchor);

				setStyles($anchor, $smallImg, $lens, $zoomContainer, $largeImg);

				$largeImg.attr('src', largeImageUrl);

				setupLens($lens, $smallImg, $largeImg);

				toggleZoom($anchor, false);

				$anchor
					.bind('mouseenter.bigImage', function () {
						toggleZoom($anchor);

						var imageRatios = calculateImageRatios($smallImg, $largeImg);

						$anchor.bind('mousemove.bigImage', function (e) {
							moveZoom($lens, $smallImg, $largeImg, imageRatios, e);
						});
					})
					.bind('mouseleave.bigImage', function () {
						toggleZoom($anchor);

						$smallImg.unbind('mousemove.bigImage');
					});
			});
		},

		changeImage: function (anchor, options) {
			var $anchor = $(anchor);

			if (!$anchor.data('bigImageId')) {
				throwBigImageError('must be initialized to change image');
			}

			var $lens    = getLens($anchor),
				$loading = getDomSetting(getSettings($anchor), 'lensLoading');

			$anchor.attr('href', options.largeImageUrl);
			$lens.append($loading);

			preload(options.smallImageUrl, options.largeImageUrl, function () {
				var $smallImg      = getSmallImage($anchor),
					$largeImg      = getLargeImage($anchor),
					$zoomContainer = getZoomContainer($anchor);

				$smallImg.attr('src', options.smallImageUrl);
				$largeImg.attr('src', options.largeImageUrl);

				$zoomContainer.show();
				setupLens($lens, $smallImg, $largeImg);

				toggleZoom($anchor, false);

				$loading.remove();
			});
		},

		destroy: function (anchor) {
			var $anchor = $(anchor);

			if (!$anchor.data('bigImageId')) {
				throwBigImageError('plugin not initialized');
			}

			var $lens          = getLens($anchor);
				$zoomContainer = getZoomContainer($anchor),
				id             = $anchor.data('bigImageId');

			$anchor
				.unbind('click.bigImage')
				.unbind('mouseenter.bigImage')
				.unbind('mousemove.bigImage')
				.unbind('mouseleave.bigImage')
				.data('bigImageId', null)

			$lens.remove();
			$zoomContainer.remove();

			$.bigImage.zoomContainers[id] = null;
			$.bigImage.settings[id] = null;

			var anchorIndex = $.bigImage.anchors.indexOf(anchor);
			$.bigImage.anchors.splice(anchorIndex, 1);
		}
	});

	$.fn.bigImage = function () {
		var argumentsArray = $.makeArray(arguments),
			command = null,
			options = argumentsArray[argumentsArray.length - 1];

		$.each(COMMANDS, function (name, fn) {
			if (fn(argumentsArray)) {
				command = name;
			}
		});

		if (!command) {
			throwBigImageError('invalid method name');
		}

		return $(this).each(function () {
			$.bigImage[command](this, options);
		});
	};


	/*
	* Private Functions
	*
	*/

	function setSettings($anchor, settings) {
		var anchorSettings = $.extend($.bigImage.defaultSettings, settings);

		$.bigImage.settings[$anchor.data('bigImageId')] = anchorSettings;
		return anchorSettings;
	}

	function getSettings($anchor) {
		return $.bigImage.settings[$anchor.data('bigImageId')];
	}

	function setupAnchor($anchor, settings) {
		var id = (new Date()).getTime();

		$.bigImage.anchors.push($anchor[0]);
		$anchor.data('bigImageId', id);

		setSettings($anchor, settings);

		return $anchor.bind('click.bigImage', function (e) { e.preventDefault(); });
	}

	function setStyles($anchor, $smallImg, $lens, $zoomContainer, $largeImg) {
		var settings = getSettings($anchor);

		$zoomContainer.css({
			width: settings.zoomWidth + 'px',
			height: settings.zoomHeight + 'px'
		});

		if (settings.autoStyle) {
			$anchor.css({
				position: 'relative',
				display: 'block',
				width: $smallImg.width()
			});

			$smallImg.css({
				zIndex: 999
			});

			$lens.css({
				position: 'absolute',
				border: '2px solid black',
				zIndex: 1000
			});

			var anchorOffset = $anchor.offset();

			$zoomContainer.css({
				overflow: 'hidden',
				position: 'absolute',
				top: anchorOffset.top,
				left: anchorOffset.left + $anchor.outerWidth()
			});

			$largeImg.css({
				position: 'absolute'
			});
		}
	}

	function getZoomContainer($anchor) {
		var val = $.bigImage.zoomContainers[$anchor.data('bigImageId')];

		if (!val) {
			var settings = getSettings($anchor),
				$container = getDomSetting(settings, 'zoomContainer');

			val = $.bigImage.zoomContainers[$anchor.data('bigImageId')] = $container.appendTo('body');

			var wrapper = getDomSetting(settings, 'zoomWrapper');
			val.wrap(wrapper);
		}

		return val;
	}

	function getSmallImage($anchor) {
		var $val = $('img:first', $anchor);

		if (!$val.length) {
			throwBigImageError('anchor must have a image child');
		}

		return $val;
	}

	function getLargeImage($anchor) {
		var $zoomContainer = getZoomContainer($anchor),
			$val = $('img:first', $zoomContainer);

		if (!$val.length) {
			$val = $('<img/>').appendTo($zoomContainer);
		}

		return $val;
	}

	function getLens($anchor) {
		var val = $.bigImage.lenses[$anchor.data('bigImageId')];

		if (!val) {
			var settings = getSettings($anchor),
				$lens = getDomSetting(settings, 'lens');

			val = $.bigImage.lenses[$anchor.data('bigImageId')] = $lens.appendTo($anchor);
		}

		return val;
	}

	function calculateImageRatios($smallImg, $largeImg) {
		if (!$smallImg.is(':visible') || !$largeImg.is(':visible')) {
			throwBigImageError('images must be visible to calculate lens size');
		}

		var fullSizeHeight = $largeImg.height(),
			fullSizeWidth  = $largeImg.width(),

			smallSizeHeight = $smallImg.height(),
			smallSizeWidth = $smallImg.width();

		return {
			height: smallSizeHeight / fullSizeHeight,
			width: smallSizeWidth / fullSizeWidth
		};
	}

	function calculateLensSize($smallImg, $largeImg) {
		var $anchor = $smallImg.closest('a'),
			imageRatios = calculateImageRatios($smallImg, $largeImg),
			settings = getSettings($anchor);

		return {
			height: imageRatios.height * settings.zoomHeight,
			width: imageRatios.width * settings.zoomWidth
		};
	}

	function setupLens($lens, $smallImg, $largeImg) {
		var lensDimensions = calculateLensSize($smallImg, $largeImg);

		return $lens.css({
			height: lensDimensions.height + 'px',
			width: lensDimensions.width + 'px'
		});
	}

	function toggleZoom($anchor, visible) {
		var $lens          = getLens($anchor),
			$zoomContainer = getZoomContainer($anchor);

		if (typeof visible === 'undefined') {
			visible = !$zoomContainer.is(':visible');
		}

		if (visible) {
			$zoomContainer.show();
			$lens.show();
		} else {
			$zoomContainer.hide();
			$lens.hide();
		}
	}

	function moveZoom($lens, $smallImg, $largeImg, imageRatios, event) {
		var mouseOffset = $smallImg.offset(),

			lensHeight = $lens.outerHeight(),
			lensWidth = $lens.outerWidth(),

			lensTop = (event.pageY - mouseOffset.top) - (lensHeight / 2),
			lensLeft = (event.pageX - mouseOffset.left) - (lensWidth / 2);

		if (lensTop < 0) { lensTop = 0; }
		if (lensLeft < 0) { lensLeft = 0; }

		var maxLensTop = $smallImg.height() - lensHeight,
			maxLensLeft = $smallImg.width() - lensWidth;

		if (lensTop > maxLensTop) { lensTop = maxLensTop; }
		if (lensLeft > maxLensLeft) { lensLeft = maxLensLeft; }

		$lens.css({
			top: lensTop + 'px',
			left: lensLeft + 'px'
		});

		var imgTop = lensTop / imageRatios.height,
			imgLeft = lensLeft / imageRatios.width;

		$largeImg.css({
			top: (0 - imgTop) + 'px',
			left: (0 - imgLeft) + 'px'
		});
	}


	/*
	* Utility Functions
	*
	*/

	function preload() {
		var argumentsArray = $.makeArray(arguments),

			images         = argumentsArray.slice(0, argumentsArray.length - 1),
			callback       = argumentsArray[argumentsArray.length - 1],

			preloaded      = [];

		function allImagesLoaded() {
			var allLoaded = true;

			$.each(images, function (i, url) {
				allLoaded = allLoaded && $.inArray(url, preloaded) >= 0;
			});

			return allLoaded;
		}

		$.each(images, function (i, url) {
			$('<img/>')
				.load(function () {
					preloaded.push(url);

					if (allImagesLoaded()) {
						callback();
					}
				})
					.get(0)
						.src = url;
		});
	}

	function throwBigImageError(message) {
		throw 'BigImage Error: ' + message;
	}

	function getDomSetting(settings, name) {
		var value = settings[name];

		if ($.isFunction(value)) {
			value = value();
		}

		value = $(value);

		if (!value.length) {
			throwBigImageError(name + ' must be a valid HTML string or return a valid DOM object');
		}

		return value;
	}


	/*
	* Public Event Binding
	*
	*/

	$(document).bind('destroy.bigImage', function () {
		$.each($.bigImage.anchors, function (i, el) {
			$(el).bigImage('destroy');
		});
	});

})(jQuery);
