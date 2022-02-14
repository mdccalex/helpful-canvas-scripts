// ==UserScript==
// @name         Canvas - Rubric Analysis
// @namespace	https://github.com/mdccalex
// @version      0.1
// @description  Analyse distribution of rubric criteria in marked student submissions
// @author       mdccalex
// @include     https://*.instructure.com/courses/*/rubrics
// @include     https://*.instructure.com/courses/*/rubrics/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

/*
The logic is as follows:

1. Insert a button that links to an event listener appropriate to the page
2. For a single rubric in a course:
    2.1 Get the rubric details, create dictionary of rating IDs.
    2.2 Get all assignments in course
    2.3 Get all submissions for assignments using the specified rubric
    2.4 For each submission, iterate counts for rating IDs found in 'rubric_assessment'
    2.5 Display rating ID counts on the rubric page
3. For the rubric index of a course:
    3.1 Create dictionary of rubric IDs
    3.2 Get all assignments in the course
    3.3 For each assignment, iterate counts of rubric IDs found
    3.4 (optional) For each assignment, count the submissions applicable to each rubric
    3.5 Display numbers with each rubric
*/

(function() {
    'use strict';

    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    var course_id = pathname.split('/')[2];

    add_button();

    /*** GENERIC FUNCTIONS ***/
    function getNextURL(linkTxt) {
        // Get the next URL for pagination handling
        var url = null;
        if (linkTxt) {
            var links = linkTxt.split(',');
            var nextRegEx = new RegExp('^<(.*)>; rel="next"$');
            for (var i = 0; i < links.length; i++) {
                var matches = nextRegEx.exec(links[i]);
                if (matches) {
                    url = matches[1];
                };
            };
        };
        return url;
    }

    function getPaginatedRequest(url) {
        // Handle paginated requests for information
        let results = [];
        let nextUrl = url;
        while (nextUrl !== null) {
            $.ajax({
                url: nextUrl,
                type: "GET",
                async: false,
                contentType: 'application/json; charset=utf-8',
                dataType: 'JSON',
                success: function(resultData, textStatus, jqXHR) {
                    results = results.concat(resultData);
                    nextUrl = getNextURL(jqXHR.getResponseHeader('link'));
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    console.log("Error occurred:" + errorThrown);
                    console.log(jqXHR);
                },
                timeout: 5000,
            });
        };
        return results;
    }

    function getRequest(url) {
        //Make a request for a single object
        console.log("Making a single GET request to " + url);
        var result = "";
        $.ajax({
            url: url,
            type: "GET",
            async: false,
            contentType: 'application/json; charset=utf-8',
            dataType: 'JSON',
            success: function(resultData, textStatus, jqXHR) {
                result = resultData;
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log("Error occurred:" + errorThrown);
                console.log(jqXHR);
            },
            timeout: 5000,
        });
        return result;
    }

    function add_button() {
        var parent = document.querySelector('aside#right-side');
        if (parent) {
            var el = parent.querySelector('#ll_rubric');
            if (!el) {
                el = document.createElement('a');
                el.classList.add('btn', 'button-sidebar-wide');
                el.id = 'll_rubric';
                var icon = document.createElement('i');
                icon.classList.add('icon-analytics');
                el.appendChild(icon);
                if (pathname.endsWith('/rubrics')) {
                    var txt = document.createTextNode(' Analyse Rubrics');
                    el.appendChild(txt);
                    el.addEventListener('click', analyseRubricIndex);
                    parent.appendChild(el);
                } else {
                    var txt = document.createTextNode(' Analyse Rubric');
                    el.appendChild(txt);
                    el.addEventListener('click', analyseSingleRubric);
                    parent.appendChild(el);
                };
            }
        }
    }

    /*** SCRIPT SPECIFIC FUNCTIONS ***/

    function clearOutput() {
        // Clear output from previous run

        /*var el_to_remove = document.querySelectorAll(".ll_rubric_text");
        Array.from(el_to_remove).forEach((el, index) => {
            el
        });*/
        $(".ll_rubric_text").remove();
        console.log("Old output removed.");
    }

    function analyseRubricIndex() {
        //Entry point for analysing a list of rubrics
        clearOutput();

        console.log("Analysing list of rubrics");

        var rubrics = {};
        var rubric_ids = [];

        // Make lists of the rubrics in this course
        var rubrics_el = document.querySelectorAll("div#rubrics > ul > li > a");
        Array.from(rubrics_el).forEach((rubric, index) => {
            var path_split = rubric.getAttribute('href').split('/')
            var rubric_id = path_split[path_split.length-1];
            rubrics[rubric_id] = 0;
            rubric_ids.push(rubric_id);
        });

        // Get the assignments in this course, then count the rubrics used by them
        var assignments = getRequest(`https://${hostname}/api/v1/courses/${course_id}/assignments?per_page=50`);
        Array.from(assignments).forEach((assignment, i) => {
            if (assignment['rubric_settings']) {
                var rubric_id = assignment['rubric_settings']['id'];
                if (rubric_ids.indexOf(rubric_id) != -1) {
                    rubrics[rubric_id] += 1;
                };
            };
        });

        // For each rubric, show the counts
        for (const [rubric_id, count] of Object.entries(rubrics)) {
            var cur_rubric = document.querySelector(`a[href='/courses/${course_id}/rubrics/${rubric_id}']`).parentNode;
            if (count) {
                cur_rubric.innerHTML += `<span class="ll_rubric_text" style="color: red">Used in ${count} Assignments</span>`;
            } else {
                cur_rubric.innerHTML += `<span class="ll_rubric_text" style="color: red">Unused!</span>`;
            };
        };

        console.log("Analysis of rubrics finished.");

    }

    function analyseSingleRubric() {
        //Entry point for analysing a single rubric
        clearOutput();

        console.log("Analysing rubric");

        var ratings = {};
        var rubric_id = pathname.split('/')[4];

        var ratings_el = document.querySelectorAll("div.rating-main");
        Array.from(ratings_el).forEach((e, index) => {
            var cur = e.querySelector("span.rating_id").textContent;
            ratings[cur] = 0;
        });

        // Get all assignments in this course and filter on rubric ID
        var assignments = getRequest(`https://${hostname}/api/v1/courses/${course_id}/assignments?per_page=50`);
        Array.from(assignments).forEach((assignment, i) => {
            if (assignment['rubric_settings']) {
                if (assignment['rubric_settings']['id'] == rubric_id) {
                    // Rubric ID matches, get all submissions for this assignment that
                    // have been graded and iterate the counts for the ratings used.
                    var assignment_id = assignment['id'];
                    var submissions = getPaginatedRequest(`https://${hostname}/api/v1/courses/${course_id}/assignments/${assignment_id}/submissions?include[]=rubric_assessment&per_page=50`);

                    if (submissions) {
                        console.log(`Found ${submissions.length} submissions for assignment ${assignment['name']}`);
                        Array.from(submissions).forEach((submission, j) => {
                            if (submission['workflow_state'] == "graded" && submission['rubric_assessment']) {
                                var rubric_assessment = submission['rubric_assessment'];
                                for (const [criterion_id, rating] of Object.entries(rubric_assessment)) {
                                    ratings[rating['rating_id']] += 1;
                                };
                            };
                        });
                    };
                };
            };
        });

        // Show the counts on the rubric page
        for (const [rating_id, count] of Object.entries(ratings)) {
            var cur_rating = document.querySelector(`td#rating_${rating_id} > div.container > div.rating-main`);
            if (cur_rating) {
                cur_rating.innerHTML += `<span class="ll_rubric_text" style="color: red">${count} Students</span>`;
            };
        };

        console.log("Analysis of rubric finished.");
    }

})();
