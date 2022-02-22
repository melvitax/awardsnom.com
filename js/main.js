jQuery(function() { 
  enableVideoModal();
  fadeOnScroll();
})

console.log("CloudKit: listening for cloudkitloaded");
window.addEventListener('cloudkitloaded', function() {
  configureCloudKit();
  console.log("CloudKit: Loaded");
  setUpAuth();
  getTop();
});

/*************************
    CLOUD KIT FUNCTIONS 
**************************/


// Configure CloudKit
function configureCloudKit() {
  console.log("configure CloudKit for " + cloudKitEnvironment)
  CloudKit.configure({
    containers: [{
    containerIdentifier: 'iCloud.com.awardsnom',
      apiTokenAuth: {
        persist: true, 
        apiToken: cloudKitApiToken,
          signInButton: {id: 'apple-sign-in-button', theme: 'black'},
          signOutButton: {id: 'apple-sign-out-button', theme: 'black'}
      },
      environment: cloudKitEnvironment
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
    getPicks();
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

// Fetch Picks
function getPicks() {
  console.log("CloudKit: getPicks()")
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
       console.log("error: " + response.errors[0])
      } else {
        var records = response.records;
        var numberOfRecords = records.length;
        if (numberOfRecords === 0) {
          console.log('No matching Picks items')
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
function getTop(category) {
  console.log("CloudKit: getTop()")
  var container = CloudKit.getDefaultContainer();
  var publicDB = container.publicCloudDatabase;

  var query = {
    recordType: 'Top',
    filterBy: [{
      comparator: 'EQUALS', fieldName: 'show', fieldValue: { value: show }
    }, {
      comparator: 'EQUALS', fieldName: 'year', fieldValue: { value: year }
    }], 
    sortBy: [{
      fieldName: 'votes',
      ascending: false
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
          console.log('No Top items')
        } else {
          console.log('Found ' + numberOfRecords + ' Top records');

          records.forEach(function (record) {
            var fields = record.fields;
            console.log("record: " + JSON.stringify(fields))
            displayTopVote(fields.category.value, fields.nomination.value)
          });
        }
      }
    })
    .catch(function(error){
      console.log("Top fetch error: " + error)
  });
}

// Fav Button Logic
$('.nomination').on( "click", function() {

  var category = $(this).data( "category" );
  var nomination = $(this).data( "nomination" );

  var container = CloudKit.getDefaultContainer();
  var privateDB = container.privateCloudDatabase;
  var publicDB = container.publicCloudDatabase;
  var options = { zoneID: "_defaultZone" };
  // Pick query
  var query = {
    recordType: 'Picks',
    filterBy: [{
      comparator: 'EQUALS', fieldName: 'show', fieldValue: { value: show }
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
          console.log('Pick found: ' + numberOfRecords + ' records');
          var record = records[0]
          var fields = record.fields;
          recordChangeTag = record.recordChangeTag
          recordName = record.recordName
          if (category == fields.category.value && nomination == fields.nomination.value) {
            isDeselectingPick = true
          } else {
            nominationVoteToDecrease = fields.nomination.value
          }
        }
        if (isDeselectingPick) {
          // Delete pick
          privateDB.deleteRecords(recordName).then(function(deleteResponse) {
            if(deleteResponse.hasErrors) {
              console.log("error: " + deleteResponse.errors[0])
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
                  .then(function() {
                    getTop(category)
                  })
              })
          });
        } else {
          var newRecord = {
            recordType: 'Picks',
            fields: {
              show: { value: show },
              year: { value: year },
              category: { value: category },
              nomination: { value: nomination }
            }
          };
          if(recordChangeTag) {
            newRecord.recordChangeTag = recordChangeTag;
          }
          if(recordName) {
            newRecord.recordName = recordName;
          }
          // Save Pick - new or updated
          privateDB.saveRecords(newRecord).then(function(saveResponse) {
              if(saveResponse.hasErrors) {
                console.log("error: " + saveResponse.errors[0])
              } else {
                var createdRecord = saveResponse.records[0];
                var fields = createdRecord.fields;
                displayMyPick(fields.category.value, fields.nomination.value, true)
              }
              hideMyPickLoading(category, nomination)
              // Update count
            if (isUpdatingPick) {
              updateVote(show, year, category, nomination, nominationVoteToDecrease) 
                .then(function (updated) {
                  syncTop(show, year, category)
                    .then(function() {
                      getTop(category)
                    })
                })
            } else {
              updateVote(show, year, category, nomination, null)
                .then(function (updated) {
                  syncTop(show, year, category)
                    .then(function() {
                      getTop(category)
                    })
                })
            }
          });
        }
      }
    })
    .catch(function(error){
      if (error.ckErrorCode == "AUTHENTICATION_REQUIRED") {
        displaySignIn()
      }
      hideMyPickLoading(category, nomination)
    });
})

// Update Votes
function updateVote(show, year, category, nominationToIncrease, nominationToDecrease) {
  console.log("updateVote()")
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
        comparator: 'EQUALS', fieldName: 'category', fieldValue: { value: category }
      }]
    };
    // Check if there's an entry first
    publicDB.performQuery(query)
      .then(function (response) {
        var records = response.records;
        if(response.hasErrors) {
          console.log("error: " + response.errors[0])
        } else {
          var newRecords = []
          if (nominationToIncrease) {
            newRecords.push(
              {
                recordType: 'Votes',
                fields: {
                  show: { value: show },
                  year: { value: year },
                  category: { value: category },
                  nomination: { value: nominationToIncrease }, 
                  votes: { value: 1 }
                }
              }
            )
          }
          if (nominationToDecrease) {
            newRecords.push(
              {
                recordType: 'Votes',
                fields: {
                  show: { value: show },
                  year: { value: year },
                  category: { value: category },
                  nomination: { value: nominationToDecrease }
                }
              }
            )
          }
          if (records.length === 0) {
            console.log('No matching items in Votes')
          } else {
            for (i=0; i<records.length; i++) {
              var record = records[i]
              var fields = record.fields;
              for (j=0; j<newRecords.length; j++) {
                if (fields.nomination.value === newRecords[j].fields.nomination.value) {
                  var offset = fields.nomination.value === nominationToIncrease ? 1 : -1
                  var currentVote = (fields.votes.value === undefined) ? 0 : fields.votes.value
                  newRecords[j].fields.votes = { value: Math.max((currentVote + offset), 0) }
                  newRecords[j].recordChangeTag = record.recordChangeTag
                  newRecords[j].recordName = record.recordName
                }
              }
            }
          }
          publicDB.saveRecords(newRecords)
            .then(function(saveResponse) {
                if(saveResponse.hasErrors) {
                  console.log("updateVote error: " + saveResponse.errors[0])
                } else {
                  fulfilled(saveResponse.records)
                }
            }).catch(function(error){
              console.log("updateVote saving vote error: " + error)
            });
        }
      }).catch(function(error){
        console.log("updateVote Query error: " + error)
      })
  })
}

// Update Top Rated
function syncTop(show, year, category) {
  console.log("syncTop()")
  return new Promise(function (fulfilled) {
    var container = CloudKit.getDefaultContainer();
    var publicDB = container.publicCloudDatabase;
    var options = {
      zoneName: '_defaultZone'
    };
    // Votes Query
    var votesQuery = {
      recordType: 'Votes',
      sortBy: [{
        fieldName: 'votes',
        ascending: false
      }],  
      filterBy: [{
        comparator: 'EQUALS', fieldName: 'show', fieldValue: { value: show }
      }, {
        comparator: 'EQUALS', fieldName: 'year', fieldValue: { value: year }
      }, {
        comparator: 'EQUALS', fieldName: 'category', fieldValue: { value: category }
      }]
    };

    // Check for highest vote in categery
    publicDB.performQuery(votesQuery, options)
      .then(function (votesResponse) {
        var votesRecords = votesResponse.records;
        if(votesResponse.hasErrors) {
          console.log("error: " + votesResponse.errors[0])
        } else {
          if (votesRecords.length > 0) {
            var voteRecord = votesRecords[0]
            // Top Query
            var topQuery = {
              recordType: 'Top',
              filterBy: [{
                comparator: 'EQUALS', fieldName: 'show', fieldValue: { value: show }
              }, {
                comparator: 'EQUALS', fieldName: 'year', fieldValue: { value: year }
              }, {
                comparator: 'EQUALS', fieldName: 'category', fieldValue: { value: category }
              }]
            };
            // Sorting fix
            var indexAndCount = []
            for (i=0; i<votesRecords.length; i++) {
              indexAndCount.push({index: i, count: votesRecords[i].fields.votes.value})
            }
            var sorted = indexAndCount.sort(({count:a}, {count:b}) => b-a);
            var index = sorted[0].index
            var voteRecord = votesRecords[index]
            
            publicDB.performQuery(topQuery, { resultsLimit: 1 })
              .then(function (topResponse) {
                var newRecord = {
                  recordType: 'Top',
                  fields: {
                    show: { value: show },
                    year: { value: year },
                    category: { value: category },
                    nomination: { value: voteRecord.fields.nomination.value }, 
                    votes: { value: voteRecord.fields.votes.value }
                  }
                };
                if(topResponse.hasErrors) {
                  console.log("error: " + topResponse.errors[0])
                } else {
                  var votes = 0
                  if (topResponse.records.length > 0) {
                    var record = topResponse.records[0]
                    newRecord.recordChangeTag = record.recordChangeTag
                    newRecord.recordName = record.recordName
                  }
                }
                publicDB.saveRecords(newRecord).then(function(saveResponse) {
                    if(saveResponse.hasErrors) {
                      console.log("error: " + saveResponse.errors[0])
                    } else {
                      fulfilled(saveResponse.records)
                    }
                })
              })
          }
        }
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
        displaySignIn()
      }
      console.log("discoverAllUserIdentities error: " + error)
    });
}
// $('.discover-users').on( "click", function() {
//   discoverAllUserIdentities()
// })

// Display Sign In
function displaySignIn() {
  alert("Sign in to iCloud to save your pick")
}

// Display username
function displayUserName(name) {
  var displayedUserName = document.getElementById('displayed-username');
  displayedUserName.textContent = name;
}

// Display Loading My Pick
function displayMyPickLoading(category, nomination) {
  $(".nomination[data-category='" + category + "'][data-nomination='" + nomination + "'] .rating").prepend('<span class="loading-spinner spinner-border text-warning mt-1" role="status" style="width: 1.1em; height: 1.1em;"><span class="visually-hidden">Loading...</span></span>')
}

// Hide Loading My Pick
function hideMyPickLoading(category, nomination) {
  $(".nomination[data-category='" + category + "'][data-nomination='" + nomination + "'] .loading-spinner").remove()
}

// Display My Pick
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
