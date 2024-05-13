// ==UserScript==
// @name         Canvas User Enrolment Search
// @namespace    https://github.com/mdccalex
// @version      0.1
// @description  Adds search functionality to the enrolments list on a user in Canvas.
// @author       mdccalex
// @include      https://*.instructure.com/accounts/*/users/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    user_enrolments_create_search_form();

    function user_enrolments_hide_all () {
        // Hide all existing enrolments before applying the filters
        console.log("Hiding all courses");
        $("div.courses > ul > li").each(function () {
           $(this).hide();
        });
        $("div#courses_list > h3").first().text("Courses (0)");

    };

    function getCheckboxValues() {
        // Get the values of the checked checkbox inputs
        var results = [];
        $('#enrolments_search_form:checkbox:checked').each(function () {
            results.push($(this).val());
        });
        return results;
    };

    function user_enrolments_update_search () {
        // Update the course list according to the search parameters.
        console.log("Updating search");

        var active_only = $("input#active_search").is(":checked");
        var current_year_only = $("input#year_search").is(":checked");

        var text_search = $("input#text_search").val().toLowerCase();
        console.log(text_search);

        var show_count = 0;

        $("div.courses > ul > li").each(function () {
            var subtitles = "";
            $(this).children("a").each(function () {
                subtitles = $(this).text().toLowerCase();
            });

            // console.log("subtitles" + subtitles);
            var is_active = (subtitles.indexOf("active") !== -1);
            var is_current_year = (subtitles.indexOf("2024") !== -1);
            var matches_text = (subtitles.indexOf(text_search) !== -1);

            if ((!is_active && active_only) || (!is_current_year && current_year_only) || (!(matches_text))) {
                $(this).hide();
            } else {
                $(this).show();
                show_count += 1;
            };
        });

        $("div#courses_list > h3").first().text(`Courses (${show_count})`);

    };

    function user_enrolments_create_search_form () {
        // Create the search form elements
        console.log("Creating search form");

        var parent = document.querySelector('fieldset#courses');
        if (parent) {
            var el = parent.querySelector('#user_enrolments_search');
            if (!el) {
                el = document.createElement('form')
            }
        };

        $("fieldset#courses").each(function () {
            $(this).prepend(`<form id="enrolments_search_form">
            <label for="active_search">Active: </label>  <input type="checkbox" id="active_search" name="active_search" /><br />
            <label for="year_search">Current Year: </label>  <input type="checkbox" id="year_search" name="year_search" /><br />
            <label for="text_search">Search: </label>  <input type="text" id="text_search" name="text_search" /></form>`);
        });

        console.log("Search form created");

        $("form#enrolments_search_form > input:checkbox").click(user_enrolments_update_search);
        $("form#enrolments_search_form > input:text").keyup(user_enrolments_update_search);
    };



})();
