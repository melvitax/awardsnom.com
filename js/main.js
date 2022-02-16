$( document ).ready(function() {

  updateAllFavButtons()
  enableModalWindowTrailers();

  // Modal Window
  function enableModalWindowTrailers(){
    $("body").find('[data-bs-toggle="modal"]').click(function() {
      var theModal = $(this).data( "bs-target" );
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
    var idParts = id.split("_")
    var value = idParts[idParts.length - 1]
    var key = id.substr(0, id.length-value.length-1)
    var cookie = getCookie(key)
    var newValue = (cookie == value) ? null : value
    setCookie(key, newValue, 365)
    updateAllFavButtons()
  })

  // Update Fav Buttons status
  function updateAllFavButtons() {
    $('.card').each(function() {
      var id = $(this).attr('id').split("__")[1]
      var idParts = id.split("_")
      var value = idParts[idParts.length - 1]
      var key = id.substr(0, id.length-value.length-1)
      var cookie = getCookie(key)
      if (cookie == value) {
        $('#card__'+id).addClass('isFavorite')
      } else {
        $('#card__'+id).removeClass('isFavorite')
      }
    });
  }

})

window.addEventListener('cloudkitloaded', function() {
  // Configure
  CloudKit.configure({
    containers: [{
    containerIdentifier: 'iCloud.io.startway.CloudKitCatalog',
      apiTokenAuth: {
          apiToken: '046e21559bac3935deffbacbe5df358a7cbc3cbc263a0b2a694592f0331ae024',
          persist: true, 
          signInButton: {
            id: 'apple-sign-in-button',
            theme: 'black' 
          },
          signOutButton: {
            id: 'apple-sign-out-button',
            theme: 'black'
          }
      },
      environment: 'development'
      }]
  });

  function setUpAuth() {

    // Get the container.
    var container = CloudKit.getDefaultContainer();
  
    function gotoAuthenticatedState(userIdentity) {
      var name = userIdentity.nameComponents;
      if(name) {
        displayUserName(name.givenName + ' ' + name.familyName);
      } else {
        displayUserName('User record name: ' + userIdentity.userRecordName);
      }
      container
        .whenUserSignsOut()
        .then(gotoUnauthenticatedState);
    }
    function gotoUnauthenticatedState(error) {
  
      if(error && error.ckErrorCode === 'AUTH_PERSIST_ERROR') {
        showDialogForPersistError();
      }
  
      displayUserName('Unauthenticated (Please Login First)');
      container
        .whenUserSignsIn()
        .then(gotoAuthenticatedState)
        .catch(gotoUnauthenticatedState);
    }
  
    // Check a user is signed in and render the appropriate button.
    return container.setUpAuth()
      .then(function(userIdentity) {
  
        // Either a sign-in or a sign-out button was added to the DOM.
  
        // userIdentity is the signed-in user or null.
        if(userIdentity) {
          gotoAuthenticatedState(userIdentity);
        } else {
          gotoUnauthenticatedState();
        }
      });

  }
  setUpAuth()
});
