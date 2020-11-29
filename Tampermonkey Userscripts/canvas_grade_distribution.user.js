// ==UserScript==
// @name         Canvas Gradebook - Grade Distribution
// @namespace    https://github.com/mdccalex
// @version      0.1
// @description  Retrieve a grade distribution for a course in Canvas.
// @author       mdccalex
// @match        https://*.instructure.com/courses/*/gradebook
// @require      https://code.jquery.com/jquery-1.12.4.min.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// Documentation available at https://github.com/mdccalex/helpful-canvas-scripts/wiki/canvas_grade_distribution.user.js

function getNextURL(linkTxt) {
  var url = null;
  if (linkTxt) {
    var links = linkTxt.split(',');
    var nextRegEx = new RegExp('^<(.*)>; rel="next"$');
    for (var i = 0; i < links.length; i++) {
      var matches = nextRegEx.exec(links[i]);
      if (matches) {
        url = matches[1];
      }
    }
  }
  return url;
}

function getPaginatedRequest(url) {
    let results = [];
    let nextUrl = url;
    while (nextUrl !== null) {
        console.log("Next URL (out of ajax): " + nextUrl);
           $.ajax({
           url: nextUrl,
           type: "GET",
           async: false,
           contentType: 'application/json; charset=utf-8',
           dataType: 'JSON',
           success: function(resultData, textStatus, jqXHR) {
               console.log(resultData);
               results = results.concat(resultData);
               nextUrl = getNextURL(jqXHR.getResponseHeader('link'));
           },
           error: function(jqXHR, textStatus, errorThrown) {
               console.log("Error occurred:" + errorThrown);
               console.log(jqXHR);
           },
           timeout: 30000,
           });
    };
    return results;
}

function stripJSONToList(json_data, target_key) {
    var result = [];
    json_data.forEach(function (value, index, array) {
        result.push(value[target_key]);
    });
    return result;
}

function waitForElement(selector, callback) {
    if ($(selector).length) {
        callback();
    } else {
        setTimeout(function() {
            waitForElement(selector, callback);
        }, 5000);
    }
}

function startGradeDistribution() {
    console.log("Starting grade distribution count");

    $("#grade_distribution_tampermonkey").prop("disabled", true); //Disable the grade distribution button

    //Get the instructure sub-domain and the course ID
    const hostname = window.location.hostname;
    const course_id = window.location.pathname.split("/",3)[2];
    
    //Get the list of active students in the course
    var url = `https://${hostname}/api/v1/courses/${course_id}/users?enrollment_type[]=student&per_page=50`;
    var students = getPaginatedRequest(url);
    var student_ids = stripJSONToList(students, 'id');
    var total_student_ids = student_ids.length;

    $("#grade_distribution_tampermonkey").text(`0/${total_student_ids}`);

    var student_grade_map = {}; //Map of student IDs to grades.
    var grade_distribution = {'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0};

    //While there are still unmapped student IDs, check gradebook HTML
    //for grades corresponding to student IDs.
    function harvestGradesLoop () {
        setTimeout(function () {
            console.log("Running grade check, length of student_ids is " + student_ids.length.toString());
            $("div.canvas_1 > div.slick-row").each(function (i, e) {
                for (var j = 0; j < e.classList.length; j++) {
                    if (!e.classList[j]) {
                        continue;
                    };
                    var class_split = e.classList[j].split("_");
                    if (class_split.length == 2) {
                        if (class_split[0] == "student" && student_ids.includes(parseInt(class_split[1]))) {
                            //Here we now need to find the grade
                            $(`div.slick-row.student_${class_split[1]} span.grades span.letter-grade-points`).each(function (i, e) {
                                var grade = $(this).text();
                                student_grade_map[parseInt(class_split[1])] = grade;
                                grade_distribution[grade] += 1;

                                //And then remove that id from the list of student ids
                                var target_index = student_ids.findIndex((element) => element == parseInt(class_split[1]));
                                var sid = student_ids.splice(target_index, 1)[0];
                                //console.log("Found " + sid + " with grade " + grade);
                                $("#grade_distribution_tampermonkey").text(`${total_student_ids-student_ids.length}/${total_student_ids}`);
                            });
                        };
                    };
                };
            });

            //Decide whether to loop again.
            if (student_ids.length > 0) {
                harvestGradesLoop();
            } else {
                console.log("All grades found!");
                document.getElementById("grade_distribution_tampermonkey").style.display = 'none';

                var alert_text = `Grade distribution check complete!\n\nA - ${grade_distribution['A']}\nB - ${grade_distribution['B']}\nC - ${grade_distribution['C']}\nD - ${grade_distribution['D']}\nE - ${grade_distribution['E']}`;

                alert(alert_text);
               
                console.log(student_grade_map);
                console.log(grade_distribution);
            };
        }, 1000);
    };

    //Start the loop.
    harvestGradesLoop();
}

(function() {
    'use strict';

    waitForElement("div.canvas_1 > div.slick-row", function () {

        $("body").append( `
<button id="grade_distribution_tampermonkey" style="position: relative; left:80%; width: auto; text-align: center; margin: 20px;" type="button" class="btn btn-primary">Check Grade Distribution</button>
` );
        $("#grade_distribution_tampermonkey").click(startGradeDistribution);
        //startGradeDistribution();

    });

})();
