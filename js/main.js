jQuery(function() { 
  enableVideoModal();
  fadeOnScroll();
})

console.log("CloudKit: listening for cloudkitloaded");
window.addEventListener('cloudkitloaded', function() {
  configureCloudKit();
  console.log("CloudKit: Loaded");
  setUpAuth();
  getTopRated();
});

/*************************
    CLOUD KIT FUNCTIONS 
**************************/

// Configure CloudKit
function configureCloudKit() {
  CloudKit.configure({
    containers: [{
    containerIdentifier: 'iCloud.com.awardsnom',
      apiTokenAuth: {
          apiToken: '046e21559bac3935deffbacbe5df358a7cbc3cbc263a0b2a694592f0331ae024',
          persist: true, 
          signInButton: {id: 'apple-sign-in-button', theme: 'black'},
          signOutButton: {id: 'apple-sign-out-button', theme: 'black'}
      },
      environment: 'development'
      }]
  });
}

// Autehnticate
function setUpAuth() {
  var container = CloudKit.getDefaultContainer();

  function gotoAuthenticatedState(userIdentity) {
    var name = userIdentity.nameComponents;
    console.log("CloudKit: userIdentity: " + JSON.stringify(userIdentity))
    if(name) {
      displayUserName(name.givenName + ' ' + name.familyName);
    }
    getEventPicks();
    container
      .whenUserSignsOut()
      .then(gotoUnauthenticatedState);
  }

  function gotoUnauthenticatedState(error) {
    if(error && error.ckErrorCode === 'AUTH_PERSIST_ERROR') {
      console.log("CloudKit: Unable to set a cookie")
    }
    container
      .whenUserSignsIn()
      .then(gotoAuthenticatedState)
      .catch(gotoUnauthenticatedState);
  }

  // Check a user is signed in and render the appropriate button.
  return container.setUpAuth()
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

// Display username
function displayUserName(name) {
  var displayedUserName = document.getElementById('displayed-username');
  displayedUserName.textContent = name;
}

// Fetch Event Picks
function getEventPicks() {
  console.log("CloudKit: getEventPicks()")
  var container = CloudKit.getDefaultContainer();
  var privateDB = container.privateCloudDatabase;

  var query = {
    recordType: 'Picks',
    filterBy: [{
      comparator: 'EQUALS', fieldName: 'event', fieldValue: { value: event }
    }, {
      comparator: 'EQUALS', fieldName: 'year', fieldValue: { value: year }
    }]
  };

  privateDB.performQuery(query)
    .then(function (response) {
      if(response.hasErrors) {
       console.log("error: " + response.errors[0])
      } else {
        var records = response.records;
        var numberOfRecords = records.length;
        if (numberOfRecords === 0) {
          console.log('No matching items')
        } else {
          console.log('Found ' + numberOfRecords + ' records');
          records.forEach(function (record) {
            var fields = record.fields;
            console.log("record: " + JSON.stringify(fields))
            displayMyPick(fields.category.value, fields.nomination.value, true)
          });
        }
      }
    })
}

// Fetch Top Rated
function getTopRated(category) {
  console.log("CloudKit: getTopRated()")
  var container = CloudKit.getDefaultContainer();
  var publicDB = container.publicCloudDatabase;

  var query = {
    recordType: 'TopRated',
    filterBy: [{
      comparator: 'EQUALS', fieldName: 'event', fieldValue: { value: event }
    }, {
      comparator: 'EQUALS', fieldName: 'year', fieldValue: { value: year }
    }]
  };
  if (category) {
    query.filterBy.push({
      comparator: 'EQUALS', fieldName: 'category', fieldValue: { value: category }
    })
  }

  publicDB.performQuery(query)
    .then(function (response) {
      if(response.hasErrors) {
       console.log("error: " + response.errors[0])
      } else {
        var records = response.records;
        var numberOfRecords = records.length;
        if (numberOfRecords === 0) {
          console.log('No TopRated items')
        } else {
          console.log('Found ' + numberOfRecords + ' TopRated records');
          records.forEach(function (record) {
            var fields = record.fields;
            console.log("record: " + JSON.stringify(fields))
            displayTopVote(fields.category.value, fields.nomination.value)
          });
        }
      }
    })
    .catch(function(error){
      console.log("TopRated fetch error: " + error)
  });
}

// Fav Button Logic
$('.nomination').on( "click", function() {

  var category = $(this).data( "category" );
  var nomination = $(this).data( "nomination" );

  console.log("CloudKit toggle: event: " + event + " year: " + year + " category: " + category + " nomination: " + nomination)

  var container = CloudKit.getDefaultContainer();
  var privateDB = container.privateCloudDatabase;
  var publicDB = container.publicCloudDatabase;
  var options = { zoneID: "_defaultZone" };

  var query = {
    recordType: 'Picks',
    filterBy: [{
      comparator: 'EQUALS', fieldName: 'event', fieldValue: { value: event }
    }, {
      comparator: 'EQUALS', fieldName: 'year', fieldValue: { value: year }
    }, {
      comparator: 'EQUALS', fieldName: 'category', fieldValue: { value: category }
    }]
  };

  displayMyPick(category, nomination, false)
  displayMyPickLoading(category, nomination)

  // Check if there's an entry for this category
  privateDB.performQuery(query, { resultsLimit: 1 })
    .then(function (response) {
      if(response.hasErrors) {
       console.log("error: " + response.errors[0])
      } else {
        var records = response.records;
        var numberOfRecords = records.length;
        var isUpdatingPick = numberOfRecords > 0
        var recordChangeTag
        var recordName
        var isDeselectingPick = false
        var nominationVoteToDecrease = nomination

        if (isUpdatingPick) {         
          console.log('Found ' + numberOfRecords + ' records');
          var record = records[0]
          var fields = record.fields;
          recordChangeTag = record.recordChangeTag
          recordName = record.recordName
          if (category == fields.category.value && nomination == fields.nomination.value) {
            isDeselectingPick = true
          } else {
            nominationVoteToDecrease = fields.nomination.value
          }
          console.log("record: " + JSON.stringify(fields))
        } else {
          console.log('No matching items')
        }
        if (isDeselectingPick) {
          // Delete pick
          privateDB.deleteRecords(recordName).then(function(response) {
            if(response.hasErrors) {
              console.log("error: " + response.errors[0])
            } else {
              var deletedRecord = response.records[0];
              console.log("deletedRecord: " + deletedRecord)
              displayMyPick(fields.category.value, fields.nomination.value, false)
            }
            hideMyPickLoading(category, nomination)
          });
          // Update count
          increaseVote(false, event, year, category, nominationVoteToDecrease)
          updateTopRated(event, year, category, nomination)
        } else {
          var record = {
            recordType: 'Picks',
            fields: {
              event: { value: event },
              year: { value: year },
              category: { value: category },
              nomination: { value: nomination }
            }
          };
          if(recordChangeTag) {
            record.recordChangeTag = recordChangeTag;
          }
          if(recordName) {
            record.recordName = recordName;
          }
          // Save Pick - new or updated
          privateDB.saveRecords(record).then(function(response) {
              if(response.hasErrors) {
                console.log("error: " + response.errors[0])
              } else {
                var createdRecord = response.records[0];
                var fields = createdRecord.fields;
                displayMyPick(fields.category.value, fields.nomination.value, true)
              }
              hideMyPickLoading(category, nomination)
          });
          // Update count
          if (isUpdatingPick) {
            increaseVote(false, event, year, category, nominationVoteToDecrease) 
          }
          increaseVote(true, event, year, category, nomination)
          updateTopRated(event, year, category, nomination)
        }
      }
    })
    .catch(function(error){
      if (error.ckErrorCode == "AUTHENTICATION_REQUIRED") {
        showSignIn()
      }
      hideMyPickLoading(category, nomination)
    });
})

// Update Top Rated
function updateTopRated(event, year, category, nomination) {
  console.log("updateTopRated()")
  var container = CloudKit.getDefaultContainer();
  var publicDB = container.publicCloudDatabase;
  var options = { zoneID: "_defaultZone" };

  var query = {
    recordType: 'Votes',
    filterBy: [{
      comparator: 'EQUALS', fieldName: 'event', fieldValue: { value: event }
    }, {
      comparator: 'EQUALS', fieldName: 'year', fieldValue: { value: year }
    }, {
      comparator: 'EQUALS', fieldName: 'category', fieldValue: { value: category }
    }], 
    sortBy: [{
      fieldName: 'votes',
      ascending: false
    }]
  };

  // Check for highest vote in categery
  publicDB.performQuery(query, { resultsLimit: 1 })
    .then(function (response) {
      var records = response.records;
      var numberOfRecords = records.length;
      if(response.hasErrors) {
        console.log("error: " + response.errors[0])
      } else {
        if (numberOfRecords > 0) {
          console.log('updateTopRated() Found ' + numberOfRecords + ' Votes records');
          var topRatedQuery = {
            recordType: 'TopRated',
            filterBy: [{
              comparator: 'EQUALS', fieldName: 'event', fieldValue: { value: event }
            }, {
              comparator: 'EQUALS', fieldName: 'year', fieldValue: { value: year }
            }, {
              comparator: 'EQUALS', fieldName: 'category', fieldValue: { value: category }
            }]
          };
          publicDB.performQuery(topRatedQuery, { resultsLimit: 1 })
            .then(function (topRatedResponse) {
              var recordChangeTag
              var recordName
              if(response.hasErrors) {
                console.log("error: " + response.errors[0])
              } else {
                var votes = 0
                if (topRatedResponse.records.length > 0) {
                  var record = topRatedResponse.records[0]
                  recordChangeTag = record.recordChangeTag
                  recordName = record.recordName
                  votes = record.fields.votes.value
                }
                var record = {
                  recordType: 'TopRated',
                  fields: {
                    event: { value: event },
                    year: { value: year },
                    category: { value: category },
                    nomination: { value: nomination }, 
                    votes: { value: votes }
                  }
                };
                // To modify an existing record, supply a recordChangeTag.
                if(recordChangeTag) {
                  record.recordChangeTag = recordChangeTag;
                }
                // If no recordName is supplied the server will generate one.
                if(recordName) {
                  record.recordName = recordName;
                }
                console.log("saving vote record: " + JSON.stringify(record))
                publicDB.saveRecords(record).then(function(response) {
                    if(response.hasErrors) {
                      console.log("error: " + response.errors[0])
                    } else {
                      var createdRecord = response.records[0];
                      var fields = createdRecord.fields;
                      console.log("new vote " + category + " " + nomination +": " +fields.votes.value )
                      getTopRated(category)
                    }
                });
              }
            })
        }
      }
    })
}

// Update Vote
function increaseVote(increasing, event, year, category, nomination) {
  var container = CloudKit.getDefaultContainer();
  var publicDB = container.publicCloudDatabase;
  var options = { zoneID: "_defaultZone" };

  var query = {
    recordType: 'Votes',
    filterBy: [{
      comparator: 'EQUALS', fieldName: 'event', fieldValue: { value: event }
    }, {
      comparator: 'EQUALS', fieldName: 'year', fieldValue: { value: year }
    }, {
      comparator: 'EQUALS', fieldName: 'category', fieldValue: { value: category }
    }, {
      comparator: 'EQUALS', fieldName: 'nomination', fieldValue: { value: nomination }
    }]
  };

  // Check if there's an entry first
  publicDB.performQuery(query, { resultsLimit: 1 })
    .then(function (response) {
      var records = response.records;
      var numberOfRecords = records.length;
      var recordChangeTag
      var recordName
      var votes = increasing ? 1 : -1
      if(response.hasErrors) {
        console.log("error: " + response.errors[0])
      } else {
        if (numberOfRecords === 0) {
          console.log('No matching items in Votes')
        } else {
          console.log('Found ' + numberOfRecords + ' records');
          var record = records[0]
          var fields = record.fields;
          recordChangeTag = record.recordChangeTag
          recordName = record.recordName
          votes += fields.votes.value
          console.log("found vote " + category + " " + nomination +": " +fields.votes.value )
        }
        var record = {
          recordType: 'Votes',
          fields: {
            event: { value: event },
            year: { value: year },
            category: { value: category },
            nomination: { value: nomination }, 
            votes: { value: votes }
          }
        };
        // To modify an existing record, supply a recordChangeTag.
        if(recordChangeTag) {
          record.recordChangeTag = recordChangeTag;
        }
        // If no recordName is supplied the server will generate one.
        if(recordName) {
          record.recordName = recordName;
        }
        console.log("saving vote record: " + JSON.stringify(record))
        publicDB.saveRecords(record).then(function(response) {
            if(response.hasErrors) {
              console.log("error: " + response.errors[0])
            } else {
              var createdRecord = response.records[0];
              var fields = createdRecord.fields;
              console.log("new vote " + category + " " + nomination +": " +fields.votes.value )
            }
        });
      }
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
        showSignIn()
      }
      console.log("shareWithUI error: " + error)
    });
}
// $('.share-picks').on( "click", function() {
//   shareWithUI()
// })

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
        showSignIn()
      }
      console.log("discoverAllUserIdentities error: " + error)
    });
}
$('.discover-users').on( "click", function() {
  discoverAllUserIdentities()
})

function showSignIn() {
  alert("Sign in to iCloud to save your pick")
}

function displayMyPickLoading(category, nomination) {
  $(".nomination[data-category='" + category + "'][data-nomination='" + nomination + "'] .rating").prepend('<span class="loading-spinner spinner-border text-warning mt-1" role="status" style="width: 1.1em; height: 1.1em;"><span class="visually-hidden">Loading...</span></span>')
}

function hideMyPickLoading(category, nomination) {
  $(".nomination[data-category='" + category + "'][data-nomination='" + nomination + "'] .loading-spinner").remove()
}

// Display isPick
function displayMyPick(category, nomination, isPick) {
  $(".nomination[data-category='" + category + "'] .pick-icon").remove()
  if (isPick) {
    $(".nomination[data-category='" + category + "'][data-nomination='" + nomination + "'] .rating").prepend('<span class="pick-icon lh-1 text-warning pt-1 w-auto" ><i class="fa-solid fa-heart"></i> Pick</span>')
  }
  console.log("displayMyPick: " + category + " " + nomination + " " + isPick)
}

// Display isTop
function displayTopVote(category, nomination) {
  $(".nomination[data-category='" + category + "'] .top-icon").remove()
  $(".nomination[data-category='" + category + "'][data-nomination='" + nomination + "'] .rating").append('<span class="top-icon lh-1 text-info pt-1 w-auto float-end"><i class="fa-solid fa-star"></i> Top</span>')
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
  $("body").find('[data-bs-toggle="modal"]').click(function() {
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
