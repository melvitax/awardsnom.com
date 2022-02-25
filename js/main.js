"use strict";
jQuery(function() { 
  enableVideoModal();
  fadeOnScroll();
})

var userRecordName

console.log("CloudKit: listening for cloudkitloaded");
window.addEventListener('cloudkitloaded', function() {
  configureCloudKit();
  console.log("CloudKit: Loaded");
  setUpAuth();
});

/*************************
    CLOUD KIT FUNCTIONS 
**************************/


// Configure CloudKit
function configureCloudKit() {
  console.log("configure CloudKit for " + cloudKitEnvironment)
  CloudKit.configure({
    containers: [{
    containerIdentifier: 'iCloud.com.awardsnom.picks',
      apiTokenAuth: {
        persist: true, 
        apiToken: cloudKitApiToken,
          signInButton: {id: 'apple-sign-in-button', theme: 'black'},
          signOutButton: {id: 'apple-sign-out-button', theme: 'black'}
      },
      environment: cloudKitEnvironment
      }]
      // , 
      // services: {
      //   logger: window.console
      // }
  });
}

// Autehnticate
function setUpAuth() {
  var container = CloudKit.getDefaultContainer();

  function gotoAuthenticatedState(userIdentity) {
    var name = userIdentity.nameComponents;
    userRecordName = userIdentity.userRecordName
    //console.log("CloudKit: userIdentity: " + JSON.stringify(userIdentity))
    if(name) {
      displayUserName(name.givenName + ' ' + name.familyName);
    }
    getTopRated();
    getMyPicks();
    // registerForNotifications();
    container
      .whenUserSignsOut()
      .then(gotoUnauthenticatedState);
  }

  function gotoUnauthenticatedState(error) {
    if(error && error.ckErrorCode === 'AUTH_PERSIST_ERROR') {
      console.log("CloudKit: Unable to set a cookie")
    }
    getTopRated()
    container
      .whenUserSignsIn()
      .then(gotoAuthenticatedState)
      .catch(gotoUnauthenticatedState);
  }

  // Check a user is signed in and render the appropriate button.
  container.setUpAuth()
    .then(function(userIdentity) {
      if(userIdentity) {
        gotoAuthenticatedState(userIdentity);
      } else {
        gotoUnauthenticatedState();
      }
    })
    .catch(function(error){
        console.log("authentication error: " + error)
        if(error && error.ckErrorCode === 'AUTH_PERSIST_ERROR') {
          console.log("authentication error: Unable to set a cookie");
        }
    });
}

// Fetch Top Rated
function getTopRated(cat) {
  console.log("getTopRated()")
  var container = CloudKit.getDefaultContainer();
  var publicDB = container.publicCloudDatabase;

  var query = {
    recordType: 'Votes',
    filterBy: [{
      comparator: 'EQUALS', fieldName: 'show', fieldValue: { value: show }
    }, {
      comparator: 'EQUALS', fieldName: 'year', fieldValue: { value: year }
    }]
  };
  if (cat) {
    query.filterBy.push({
      comparator: 'EQUALS', fieldName: 'cat', fieldValue: { value: cat }
    })
  }
  publicDB.performQuery(query)
    .then(function (response) {
      if(response.hasErrors) {
       console.log("getTopRated error: " + response.errors[0])
      } else {
        var records = response.records;
        if (records.length === 0) {
          console.log('getTopRated query: none found')
        } else {
          var cats = new Set(records.map(a => a.fields.cat.value)) 
          cats.forEach(function (cat) {
            var sorted = records.filter(record => record.fields.cat.value == cat)
              .sort(function(a, b) {
                return a.fields.votes.value < b.fields.votes.value
              })
            var topPick = sorted[0]
            displayTopVote(topPick.fields.cat.value, topPick.fields.nom.value)
          })
        }
      }
    })
    .catch(function(error){
      console.log("getTopRated error: " + error)
  });
}

// Fetch My Picks
function getMyPicks() {
  console.log("getMyPicks()")
  var container = CloudKit.getDefaultContainer();
  var privateDB = container.privateCloudDatabase;

  var query = {
    recordType: 'Picks',
    filterBy: [{
      comparator: 'EQUALS', fieldName: 'show', fieldValue: { value: show }
    }, {
      comparator: 'EQUALS', fieldName: 'year', fieldValue: { value: year }
    }]
  };

  privateDB.performQuery(query)
    .then(function (response) {
      if(response.hasErrors) {
       console.log("getMyPicks error: " + response.errors[0])
      } else {
        var records = response.records;
        var numberOfRecords = records.length;
        if (numberOfRecords === 0) {
          console.log('getMyPicks query: none found')
        } else {
          console.log('getMyPicks query: ' + numberOfRecords + ' records');
          records.forEach(function (record) {
            var fields = record.fields;
            removePickIndicators(fields.cat.value)
            displayMyPick(fields.cat.value, fields.nom.value)
          });
        }
      }
    })
    .catch(function(error){
      console.log("getMyPicks error: " + error)
    });
}

// Toggle Pick
function togglePick(cat, nom) {
  console.log("togglePick()")
  removePickIndicators(cat)
  displayLoading()
  var container = CloudKit.getDefaultContainer();
  var privateDB = container.privateCloudDatabase;
  // Pick query
  var query = {
    recordType: 'Picks',
    filterBy: [{
      comparator: 'EQUALS', fieldName: 'show', fieldValue: { value: show }
    }, {
      comparator: 'EQUALS', fieldName: 'year', fieldValue: { value: year }
    }, {
      comparator: 'EQUALS', fieldName: 'cat', fieldValue: { value: cat }
    }
  ]
  };
  // Check if there's a pick already
  privateDB.performQuery(query)
    .then(function (response) {
      if(response.hasErrors) {
       console.log("togglePick query error: " + response.errors[0])
      } else {
        var records = response.records
        console.log("togglePick query found: " + records.length)
        // Pick Exists
        if (records.length > 0) {
          var record = records[0]
          privateDB.deleteRecords(recordName).then(function(deleteResponse) {
            if(deleteResponse.hasErrors) {
            } else {
              var deletedRecord = deleteResponse.records[0];
              console.log("Pick deletedRecord: " + deletedRecord)
              displayMyPick(category, nomination, false)
            }
            hideMyPickLoading(category, nomination)
            // Update count
            updateVote(show, year, category, null, nominationVoteToDecrease)
              .then(function () {
                syncTop(show, year, category)
                    getTop(category)
                  })
          }
          if (nom == record.fields.nom.value) {
              })
          });
              .catch(function(error){
                if (error.ckErrorCode == "AUTHENTICATION_REQUIRED") {
                  displaySignIn()
                }
                hideLoading()
              })
          }
          // Update Pick
          else {
            var prevNom = record.fields.nom.value
            record.fields.nom = { value: nom }
            console.log("togglePick update: " + record.fields.nom.value)
            privateDB.saveRecords(record)
              .then(function(updateResponse) {
                if(updateResponse.hasErrors) {
                  console.log("togglePick update error: " + deleteResponse.errors[0])
                } else {
                  var updatedRecord = updateResponse.records[0];
                  removePickIndicators(cat)
                  displayMyPick(cat, nom)
                  var votes = [
                    { nom: prevNom, value: -1 }, 
                    { nom: updatedRecord.fields.nom.value, value: 1 }
                  ]
                  updateVotes(show, year, cat, votes)
                    .then(function() {
                      getTopRated()
                    })
                  console.log("togglePick updated: " + JSON.stringify(updatedRecord))
                }
                hideLoading()
              })
              .catch(function(error){
                if (error.ckErrorCode == "AUTHENTICATION_REQUIRED") {
                  displaySignIn()
                }
                hideLoading()
              })
          }
        // New Pick
        } else {
          console.log("togglePick new: " + records.length)
          var record = {
            recordType: 'Picks',
            fields: {
              show: { value: show },
              year: { value: year },
              cat: { value: cat },
              nom: { value: nom }
            }
          };
          privateDB.saveRecords(record)
              .then(function(saveResponse) {
                if(saveResponse.hasErrors) {
                  console.log("togglePick save error: " + deleteResponse.errors[0])
                } else {
                  var updatedRecord = saveResponse.records[0];
                  removePickIndicators(cat)
                  displayMyPick(cat, nom)
                  var votes = [{ nom: updatedRecord.fields.nom.value, value: 1} ]
                  updateVotes(show, year, cat, votes)
                    .then(function() {
                      getTopRated()
                    })
                  console.log("togglePick saved: " + JSON.stringify(updatedRecord))
                }
                hideLoading()
              })
              .catch(function(error){
                if (error.ckErrorCode == "AUTHENTICATION_REQUIRED") {
                  displaySignIn()
                }
                hideLoading()
              })
        }
      }
    })
    .catch(function(error){
      console.log("togglePick query error: " + error)
      if (error.ckErrorCode == "AUTHENTICATION_REQUIRED") {
        displaySignIn()
      }
      hideLoading()
    });
}
$('.nom').on( "click", function() {
  togglePick($(this).data( "cat" ), $(this).data( "nom" ))
})

// Update Votes
function updateVotes(show, year, cat, votes) {
  console.log("updateVotes()")
  return new Promise(function (fulfilled) {
    var container = CloudKit.getDefaultContainer();
    var publicDB = container.publicCloudDatabase;
    // Votes Query
    var query = {
      recordType: 'Votes',
      filterBy: [{
        comparator: 'EQUALS', fieldName: 'show', fieldValue: { value: show }
      }, {
        comparator: 'EQUALS', fieldName: 'year', fieldValue: { value: year }
      }, {
        comparator: 'EQUALS', fieldName: 'cat', fieldValue: { value: cat }
      }]
    };
    // Check if there's an entry first
    publicDB.performQuery(query)
      .then(function (response) {
        var records = response.records;
        if(response.hasErrors) {
          console.log("updateVotes fetch error: " + response.errors[0])
        } else {
          var recordsToSave = []
          
          if (records.length === 0) {
            console.log('updateVotes query: none found')
            votes.forEach(function (vote) {
              var newValue = Math.max(vote.value, 0)
              var newRecord = {
                recordType: 'Votes',
                fields: {
                  show: { value: show },
                  year: { value: year },
                  cat: { value: cat },
                  nom: { value: vote.nom }, 
                  votes: { value: newValue }
                }
              }
              recordsToSave.push(newRecord)
            })

          } else {
            console.log('updateVotes query: found ' + records.length)
            votes.forEach(function (vote) {
              var isNewRecord = true
              records.forEach(function (record) {
                // Update vote
                if (record.fields.nom.value === vote.nom) {
                  var currentValue = (record.fields.votes.value === undefined) ? 0 : record.fields.votes.value
                  var newValue = Math.max((currentValue + vote.value), 0)
                  record.fields.votes = { value: newValue }
                  recordsToSave.push(record)
                  isNewRecord = false
                }
              })
              if (isNewRecord) {
                var newValue = Math.max(vote.value, 0)
                var newRecord = {
                  recordType: 'Votes',
                  fields: {
                    show: { value: show },
                    year: { value: year },
                    cat: { value: cat },
                    nom: { value: vote.nom }, 
                    votes: { value: newValue }
                  }
                }
                recordsToSave.push(newRecord)
              }
            })
          }
          publicDB.saveRecords(recordsToSave)
            .then(function(saveResponse) {
                if(saveResponse.hasErrors) {
                  console.log("updateVotes save error: " + saveResponse.errors[0])
                }
                fulfilled()
            }).catch(function(error){
              console.log("updateVotes save error: " + error)
            });
        }
      }).catch(function(error){
        console.log("updateVotes query error: " + error)
      })
    })
}

// Share with UI
function shareWithUI() {
  console.log("shareWithUI()")
  var container = CloudKit.getDefaultContainer();
  var privateDB = container.privateCloudDatabase;
  var zoneID = { zoneName: "_defaultZone" };
  var options = {
    zoneID: zoneID,
    shareTitle: "shareTitle",
    supportedAccess: "PRIVATE",
    supportedPermissions: "READ_ONLY"
  }
  privateDB.shareWithUI(options)
    .then(function(response) {
      if(response.hasErrors) {
        console.log("error: " + response.errors[0])
      } else {
        console.log("response: " + JSON.stringify(response))
      }
    })
    .catch(function(error){
      if (error.ckErrorCode == "AUTHENTICATION_REQUIRED") {
        displaySignIn()
      }
      console.log("shareWithUI error: " + error)
    });
}
$('.share-picks').on( "click", function() {
  shareWithUI()
})

function fetchCurrentUserIdentity() {
  var container = CloudKit.getDefaultContainer();
  container.fetchCurrentUserIdentity()
    .then(function(response) {
      if(response.hasErrors) {
        console.log("fetchCurrentUserIdentity error: " + response.errors[0])
      } else {
        console.log('fetchCurrentUserIdentity response: ' + JSON.stringify(response))
      }
    })
    .catch(function(error){
      if (error.ckErrorCode == "AUTHENTICATION_REQUIRED") {
        displaySignIn()
      }
      console.log("fetchCurrentUserIdentity error: " + error)
    });
}
$('.fetch-current-user-identity').on( "click", function() {
  fetchCurrentUserIdentity()
})

// Discover All Users
function discoverAllUserIdentities() {
  var container = CloudKit.getDefaultContainer();
  container.discoverAllUserIdentities()
    .then(function(response) {
      if(response.hasErrors) {
        console.log("discoverAllUserIdentities error: " + response.errors[0])
      } else {
        console.log('Discovered users from your iCloud contacts:')
        console.log(JSON.stringify(response.users))
      }
    })
    .catch(function(error){
      if (error.ckErrorCode == "AUTHENTICATION_REQUIRED") {
        displaySignIn()
      }
      console.log("discoverAllUserIdentities error: " + error)
    });
}
$('.discover-users').on( "click", function() {
  discoverAllUserIdentities()
})

// Accept Share
function demoAcceptShares(shortGUID) {
  var container = CloudKit.getDefaultContainer();
  container.acceptShares(shortGUID)
    .then(function(response) {
      if(response.hasErrors) {
        console.log("acceptShares error: " + response.errors[0])
      } else {
        var result = response.results[0];
        console.log("acceptShares result "+ JSON.stringify(result))
      }
    });
}

// Notifications
function registerForNotifications() {
  var container = CloudKit.getDefaultContainer();
  if(container.isRegisteredForNotifications) {
    CloudKit.Promise.resolve();
  }
  function renderNotification(notification) {
    appendNotificationToTable(
      notification.notificationID,
      notification.notificationType,
      notification.subscriptionID,
      notification.zoneID
    );
    console.log("****** NOTIFICATION *****")
    console.log(JSON.stringify(notification))
    console.log("********************")
  }
  container.addNotificationListener(renderNotification);
  container.registerForNotifications().then(function(container) {
    if(container.isRegisteredForNotifications) {
      console.log('NOTIFICATIONS: Connected');
    }
  });
}

// Display Sign In
function displaySignIn() {
  alert("Sign in to iCloud")
}

// Display username
function displayUserName(name) {
  var displayedUserName = document.getElementById('displayed-username');
  displayedUserName.textContent = name;
}

// Display Loading My Pick
function displayLoading() {
  var myModalEl = document.querySelector('#loading')
  var modal = bootstrap.Modal.getOrCreateInstance(myModalEl, {
    keyboard: false, backdrop: 'static'
  })
  modal.show()
}

// Hide Loading My Pick
function hideLoading() {
  var myModalEl = document.querySelector('#loading')
  myModalEl.addEventListener('shown.bs.modal', function (event) {
    modal.hide()
  })
  var modal = bootstrap.Modal.getOrCreateInstance(myModalEl, {
    keyboard: false, backdrop: 'static'
  })
  modal.hide()
}

// Display My Pick
function removePickIndicators(cat) {
  $(".nom[data-cat='" + cat + "'] .pick-icon").remove()
}

function displayMyPick(cat, nom) {
  $(".nom[data-cat='" + cat + "'][data-nom='" + nom + "'] .rating").prepend('<span class="pick-icon lh-1 text-warning pt-1 w-auto" ><i class="fa-solid fa-heart"></i> Pick</span>')
}

// Display isTop
function displayTopVote(cat, nom) {
  $(".nom[data-cat='" + cat + "'] .top-icon").remove()
  $(".nom[data-cat='" + cat + "'][data-nom='" + nom + "'] .rating").append('<span class="top-icon lh-1 text-info pt-1 w-auto float-end"><i class="fa-solid fa-star"></i> Top</span>')
}

/*************************
  NON CLOUD KIT FUNCTIONS 
**************************/

// Fade animation on scroll
function fadeOnScroll() {
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
}

// Modal Video Window
function enableVideoModal(){
  $("body").find('[data-bs-toggle="modal"]').on( "click", function() {
    var theModal = $(this).data( "bs-target" );
    var videoSRC = $(this).attr( "data-theVideo" );
    $(theModal+' iframe').attr('src', videoSRC);
    $(theModal).on('hidden.bs.modal', function () {
        $(theModal+' iframe').attr('src', $(theModal+' iframe').attr("src"));
    }); 
  });
}

// Set Cookie
function setCookie(c_name, value, exdays) {
  'use strict';
  var exdate = new Date();
  exdate.setDate(exdate.getDate() + exdays);
  var c_value = escape(value) + ((exdays == null) ? "" : "; expires=" + exdate.toUTCString());
  document.cookie = c_name + "=" + c_value;
}

// Get Cookie
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
