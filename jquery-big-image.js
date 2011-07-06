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

		zoomMasks: {},
		lenses: {},

		anchors: [],

		lastPositions: {}
	};

	$.extend($.bigImage, {
		defaultSettings: {
			autoStyle: true,

			zoom: {
				width: 500,
				height: 500,
				maskElement: '<div class="zoom-mask"></div>'
			},

			lens: {
				element: '<div/>',
				loadingElement: '<span class="loading">Loading...</span>'
			}
		},


		/*
		* Public Functions
		*
		*/

		init: function (anchor, settings) {
			var $anchor = $(anchor),
				largeImageUrl = $anchor.attr('href');

			setupAnchor($anchor, settings);

			var id = $anchor.data('bigImageId');

			preload(largeImageUrl, function () {
				var $smallImg = getSmallImage($anchor),
					$lens     = getLens($anchor),
					$largeImg = getLargeImage($anchor),
					$zoomMask = getZoomMask($anchor);

				setStyles($anchor, $smallImg, $lens, $zoomMask, $largeImg);

				$largeImg.attr('src', largeImageUrl);

				setupLens($lens, $smallImg, $largeImg);

				turnOffZoom($anchor);

				$anchor
					.bind('mouseenter.bigImage', function () {
						turnOnZoom($anchor);

						$anchor
							.data('imageRatios', calculateImageRatios($smallImg, $largeImg))
							.bind('mousemove.bigImage', function (e) {
								moveZoom($lens, $smallImg, $largeImg, $anchor.data('imageRatios'), [e.pageX, e.pageY]);
								savePosition($anchor, [e.pageX, e.pageY]);
							});
					})
					.bind('mouseleave.bigImage', function () {
						turnOffZoom($anchor);

						$smallImg.unbind('mousemove.bigImage');
					});
			});
		},

		changeImage: function (anchor, options) {
			var $anchor = $(anchor),
				id = $anchor.data('bigImageId');

			if (!id) {
				throwBigImageError('must be initialized to change image');
			}

			options = $.extend({ smallImageUrl: getSmallImage($anchor).attr('src') }, options);

			var $lens    = getLens($anchor),
				$loading = getElementSetting(getSettings($anchor).lens.loadingElement);

			$anchor.attr('href', options.largeImageUrl);
			$lens.append($loading);

			preload(options.smallImageUrl, options.largeImageUrl, function () {
				var $smallImg = getSmallImage($anchor),
					$largeImg = getLargeImage($anchor),
					$zoomMask = getZoomMask($anchor);

				$smallImg.attr('src', options.smallImageUrl);
				$largeImg.attr('src', options.largeImageUrl);

				$anchor.data('imageRatios', calculateImageRatios($smallImg, $largeImg));

				$zoomMask.show();
				setupLens($lens, $smallImg, $largeImg);

				$loading.remove();

				moveZoom(
					$lens,
					$smallImg,
					$largeImg,
					calculateImageRatios($smallImg, $largeImg),
					getPosition($anchor)
				);
			});
		},

		destroy: function (anchor) {
			var $anchor = $(anchor);

			if (!$anchor.data('bigImageId')) {
				throwBigImageError('plugin not initialized');
			}

			var $lens     = getLens($anchor);
				$zoomMask = getZoomMask($anchor),
				id        = $anchor.data('bigImageId');

			$anchor
				.unbind('click.bigImage')
				.unbind('mouseenter.bigImage')
				.unbind('mousemove.bigImage')
				.unbind('mouseleave.bigImage')
				.data('bigImageId', null)

			$lens.remove();
			$zoomMask.remove();

			$.bigImage.zoomMasks[id] = null;
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
		var anchorSettings = $.extend(true, $.bigImage.defaultSettings, settings);

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

	function setStyles($anchor, $smallImg, $lens, $zoomMask, $largeImg) {
		var settings = getSettings($anchor),
			anchorOffset = $anchor.offset();

		$zoomMask.css({
			overflow: 'hidden',
			width: settings.zoom.width + 'px',
			height: settings.zoom.height + 'px',

			// overlay
			position: 'absolute',
			top: anchorOffset.top,
			left: anchorOffset.left + $anchor.outerWidth()
		});

		$lens.css({
			position: 'absolute'
		});

		$largeImg.css({
			position: 'absolute'
		});

		$anchor.css({
			display: 'block',
			width: $smallImg.width()
		});

		if (settings.autoStyle) {
			$anchor.css({
				position: 'relative'
			});

			$smallImg.css({
				zIndex: 999
			});

			$lens.css({
				border: '2px solid',
				zIndex: 1000
			});
		}
	}

	function getZoomMask($anchor) {
		var val = $.bigImage.zoomMasks[$anchor.data('bigImageId')];

		if (!val) {
			var settings = getSettings($anchor),
				$container = getElementSetting(settings.zoom.maskElement);

			val = $.bigImage.zoomMasks[$anchor.data('bigImageId')] = $container.appendTo('body');

			if (settings.zoom.wrapperElement) {
				var wrapper = getElementSetting(settings.zoom.wrapperElement);
				val.wrap(wrapper);
			}
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
		var $zoomMask = getZoomMask($anchor),
			$val = $('img:first', $zoomMask);

		if (!$val.length) {
			$val = $('<img/>').appendTo($zoomMask);
		}

		return $val;
	}

	function getLens($anchor) {
		var val = $.bigImage.lenses[$anchor.data('bigImageId')];

		if (!val) {
			var settings = getSettings($anchor),
				$lens = getElementSetting(settings.lens.element);

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
			height: imageRatios.height * settings.zoom.height,
			width: imageRatios.width * settings.zoom.width
		};
	}

	function setupLens($lens, $smallImg, $largeImg) {
		var lensDimensions = calculateLensSize($smallImg, $largeImg);

		return $lens.css({
			height: lensDimensions.height + 'px',
			width: lensDimensions.width + 'px'
		});
	}

	function turnOnZoom($anchor) {
		var $lens     = getLens($anchor),
			$zoomMask = getZoomMask($anchor);

		$zoomMask.show();
		$lens.show();
	}

	function turnOffZoom($anchor) {
		var $lens     = getLens($anchor),
			$zoomMask = getZoomMask($anchor);

		$zoomMask.hide();
		$lens.hide();
	}

	function moveZoom($lens, $smallImg, $largeImg, imageRatios, position) {
		var mouseOffset = $smallImg.offset(),

			lensHeight  = $lens.outerHeight(),
			lensWidth   = $lens.outerWidth(),

			lensTop     = (position[1] - mouseOffset.top) - (lensHeight / 2),
			lensLeft    = (position[0] - mouseOffset.left) - (lensWidth / 2),

			maxLensTop  = $smallImg.height() - lensHeight,
			maxLensLeft = $smallImg.width() - lensWidth;

		if (lensTop < 0) { lensTop = 0; }
		if (lensLeft < 0) { lensLeft = 0; }

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

	function savePosition($anchor, position) {
		var id = $anchor.data('bigImageId');
		return $.bigImage.lastPositions[id] = position;
	}

	function getPosition($anchor) {
		var id = $anchor.data('bigImageId');

		if (!$.bigImage.lastPositions[id]) {
			return null;
		}

		return $.bigImage.lastPositions[id];
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

	function getElementSetting(value) {
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
