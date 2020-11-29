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

/*
==INSTRUCTIONS==

1. Go to a gradebook page for a course in Canvas
2. Scroll the page down to where the added "Check Grade Distribution" button is.
3. Scroll the gradebook table horizontally until the 'Total' column is visible.
4. Click the button
5. At a reasonable pace, scroll the gradebook table vertically until you have passed all of the grades. 
6. Once complete (progress is shown as the text of the button), a basic javascript popup appears showing the count of grades,
   and the button is hidden from view until the page is reloaded. 
*/

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
               //console.log("Next URL: " + nextUrl);
           },
           error: function(jqXHR, textStatus, errorThrown) {
               console.log("Error occurred:" + errorThrown);
               console.log(jqXHR);
           },
           timeout: 60000,
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

    var url = `https://${hostname}/api/v1/courses/${course_id}/users?enrollment_type[]=student&per_page=50`;
    var students = getPaginatedRequest(url);
    //console.log(students);
    var student_ids = stripJSONToList(students, 'id');
    //console.log(student_ids);
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
                console.log("Checking an element");
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
                //$("#grade_distribution_tampermonkey").hide();
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
