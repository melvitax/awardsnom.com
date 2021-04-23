$( document ).ready(function() {

  // Show Active Fav Buttons
  var faved = getCookie('faved')
  if (faved) {
    var array = faved.split(",")
    if (array) {
      for(var i = 0; i < array.length; i++) {
        let rawID = array[i]
        $('#card__'+rawID).addClass('isFavorite')
      }
    }
  }

  enableModalWindowTrailers();

  // Modal Window
  function enableModalWindowTrailers(){
    $("body").find('[data-toggle="modal"]').click(function() {
      var theModal = $(this).data( "target" );
      var videoSRC = $(this).attr( "data-theVideo" );
      $(theModal+' iframe').attr('src', videoSRC);
      
      $(theModal).on('hidden.bs.modal', function () {
          $(theModal+' iframe').attr('src', $(theModal+' iframe').attr("src"));
      }); 
    });
  }
  
  // Animate on Intersect
  $('body').removeClass('no-observer')
  const observerOptions = {
    rootMargin: '0px',
    threshold: 0.2
  }
  const $obsvItem = $('.animate')
  IntersectionObserver.prototype.POLL_INTERVAL = 400
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.intersectionRatio > 0) {
      entry.target.classList.add('is-active')
      observer.unobserve(entry.target)
      } else {
      entry.target.classList.remove('is-active')
      }
    })
    return entries
  }, observerOptions)
  $obsvItem.each(function (e) {
    observer.observe(this)
  })

  // Cookies
  function setCookie(c_name, value, exdays) {
    'use strict';
    var exdate = new Date();
    exdate.setDate(exdate.getDate() + exdays);
    var c_value = escape(value) + ((exdays == null) ? "" : "; expires=" + exdate.toUTCString());
    document.cookie = c_name + "=" + c_value;
  }
  function getCookie(c_name) {
    'use strict';
    var i, x, y, ARRcookies = document.cookie.split(";");
    for (i = 0; i < ARRcookies.length; i++) {
        x = ARRcookies[i].substr(0, ARRcookies[i].indexOf("="));
        y = ARRcookies[i].substr(ARRcookies[i].indexOf("=") + 1);
        x = x.replace(/^\s+|\s+$/g, "");
        if (x == c_name) {
            return unescape(y);
        }
    }
  }

  // Fav Button Logic
  $('.fav').click(function() {
    var id = $(this).parent().parent().attr('id').split("__")[1]
    console.log('id: '+id)
    $('#card__'+id).toggleClass('isFavorite')
    var isFavorite = $('#card__'+id).hasClass('isFavorite')
    var faved = getCookie('faved')
    var array = []
    if (faved) {
      array = faved.split(",")
    }
    if (isFavorite) {
      array.push(id)
    } else {
      var filtered = []
      for(var i = 0; i < array.length; i++) {
        var item = array[0]
        if (item != id) {
          filtered.push(item)
        }
      }
      array = filtered
    }
    var string = array.join(",")
    setCookie('faved', string, 365)
  })

})


