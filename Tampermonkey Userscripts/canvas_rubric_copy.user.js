// ==UserScript==
// @name        Canvas - Rubrics Copy Tool
// @namespace	https://github.com/mdccalex
// @version     0.2
// @description Copy rubrics between courses and accounts
// @author		mdccalex
// @include     https://*.instructure.com/courses/*/rubrics
// @include     https://*.instructure.com/accounts/*/rubrics
// @grant       none
// ==/UserScript==
//
// Built with inspiration from https://github.com/jamesjonesmath/canvancement and his 'import-rubric' tool.
//
(function() {
    'use strict';
    var assocRegex = new RegExp('^/(course|account)s/([0-9]+)/rubrics$');
    var errors = [];

    if (assocRegex.test(window.location.pathname)) {
        add_button();
    }

    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    function getCsrfToken() {
        var csrfRegex = new RegExp('^_csrf_token=(.*)$');
        var csrf;
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = cookies[i].trim();
            var match = csrfRegex.exec(cookie);
            if (match) {
                csrf = decodeURIComponent(match[1]);
                break;
            }
        }
        return csrf;
    }

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
            // console.log("Next URL (out of ajax): " + nextUrl);
            $.ajax({
                url: nextUrl,
                type: "GET",
                async: false,
                contentType: 'application/json; charset=utf-8',
                dataType: 'JSON',
                success: function(resultData, textStatus, jqXHR) {
                    //console.log(resultData);
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
                // console.log(resultData);
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
            var el = parent.querySelector('#kk_rubric');
            if (!el) {
                el = document.createElement('a');
                el.classList.add('btn', 'button-sidebar-wide');
                el.id = 'kk_rubric';
                var icon = document.createElement('i');
                icon.classList.add('icon-copy');
                el.appendChild(icon);
                var txt = document.createTextNode(' Copy Rubrics');
                el.appendChild(txt);
                el.addEventListener('click', openDialog);
                parent.appendChild(el);
            }
        }
    }

    function createDialog() {
        var el = document.querySelector('#kk_rubric_dialog');
        if (!el) {
            el = document.createElement('div');
            el.id = 'kk_rubric_dialog';
            el.classList.add('ic-Form-control');

            //Add the dialog layout
            el.innerHTML = "<table width='100%'><tr><td id='copy-rubric-left' width='50%'><h4>Select rubrics</h4></td><td id='copy-rubric-right' width='50%'><h4>Select destination by <select name='dest_select_by' id='dest_select_by'><option value='enrollment'>Enrollment</option><option value='subaccount'>Sub-Account</option><option value='rootaccount'>Root Account</option></select></h4></td></tr><tr style='vertical-align:top;'><td><div id='cb-Container'></div></td><td><div id='subaccount_select_box' style='display:none;'><label for='subaccount_select'>From Sub-Account: </label><select name='subaccount_select' id='subaccount_select'></select><br /></div><input type='radio' id='copy_rubric_dest_account' name='copy_rubric_dest_type' value='account'><label for='copy_rubric_dest_account'>Account</label><br /><input type='radio' id='copy_rubric_dest_course' name='copy_rubric_dest_type' value='course'><label for='copy_rubric_dest_course'>Course</label><br /><hr /><select id='copy_rubric_select_dest' class='ic-Input'></select></td></tr></table>";

            var msg = document.createElement('div');
            msg.id = 'kk_rubric_msg';
            msg.classList.add('ic-flash-warning');
            msg.style.display = 'none';
            el.appendChild(msg);
            var parent = document.querySelector('body');
            parent.appendChild(el);

            // Add a select all checkbox first
            var cb_html = "<input type='checkbox' id='cb_select_all' class='copy_rubric_cb'>";
            cb_html += "<label for='cb_select_all'> <u>Select all</u></label><br />";
            $('#cb-Container').append(cb_html);
            // Populate the checkbox list of rubrics
            $("#rubrics > ul > li > a").each(function () {
                var rubric_id = $(this).attr("href").split("rubrics/");
                rubric_id = rubric_id[rubric_id.length-1];
                var rubric_title = $(this).text();
                var cb_html = "<input type='checkbox' id='cb_" + rubric_id + "' name='cb_" + rubric_id + "' value='" + rubric_id + "' class='copy_rubric_cb'>";
                cb_html += "<label for='cb_" + rubric_id + "'>" + rubric_title + "</label><br />";
                $('#cb-Container').append(cb_html);
            });

            // Script option to select all
            $("input#cb_select_all").change(function () {
                $('.copy_rubric_cb:checkbox').not(this).prop('checked', this.checked);
            });

            // Update on dest_select_by change
            // Specifically: Show/hide the Sub-Account selector as necessary, and unselect the radio buttons for course/account.
            $("#dest_select_by").change(function () {
                var selected = $(this).val();
                console.log(selected);

                $("input:radio[name=copy_rubric_dest_type]").prop("checked", false);
                $("#copy_rubric_select_dest").empty(); // Empty the select input
                $("#subaccount_select").empty(); // Empty the sub account select input

                if (selected === "subaccount") {
                    // Display the subaccount selection box and populate it
                    $("#subaccount_select_box").css("display", "inline");

                    var accounts_url = `https://${hostname}/api/v1/accounts?per_page=50`;
                    populateDestinationSelection(accounts_url, "account", "#subaccount_select")
                } else {
                    $("#subaccount_select_box").css("display", "none");
                };
            });

            // Update the accounts or courses list if selecting by subaccount
            $("#subaccount_select").change(function () {
                $("#copy_rubric_select_dest").empty();
                var dest_type = $("input:radio[name=copy_rubric_dest_type]:checked").val();
                var subaccount_selected = $(this).val();
                var url = null;

                if (dest_type === "account") {
                    url = `https://${hostname}/api/v1/accounts/${subaccount_selected}/sub_accounts`;
                } else if (dest_type === "course") {
                    url = `https://${hostname}/api/v1/accounts/${subaccount_selected}/courses?sort=sis_course_id&order=asc`;
                };
                populateDestinationSelection(url, dest_type);
            });

            // Update destination select list on dest type change
            // Make sure that selections of account/course are dependent on dest_select_by an d
            $("input:radio[name=copy_rubric_dest_type]").change(function () {
                var dest_select_input = $("#copy_rubric_select_dest");
                dest_select_input.empty(); //Empty the select input
                var dest_select_by_input = $("#dest_select_by").val();
                if ($(this).val() === "account") {
                    var accounts_url = null;
                    if (dest_select_by_input === "enrollment") {
                        accounts_url = `https://${hostname}/api/v1/accounts?per_page=50`;
                    } else if (dest_select_by_input === "subaccount") {
                        var subaccount_selected = $("#subaccount_select").val();
                        accounts_url = `https://${hostname}/api/v1/accounts/${subaccount_selected}/sub_accounts`;
                    } else if (dest_select_by_input === "rootaccount") {
                        accounts_url = `https://${hostname}/api/v1/accounts/1/sub_accounts?per_page=50`;
                    };
                    populateDestinationSelection(accounts_url, $(this).val());
                } else if ($(this).val() === "course") {
                    // Probably need an option here to select all courses in an account or accounts
                    var courses_url = null;
                    if (dest_select_by_input === "enrollment") {
                        courses_url = `https://${hostname}/api/v1/courses?per_page=50`;
                    } else if (dest_select_by_input === "subaccount") {
                        var subaccount_selected = $("#subaccount_select").val();
                        courses_url = `https://${hostname}/api/v1/accounts/${subaccount_selected}/courses?per_page=50&sort=sis_course_id&order=asc`;
                    } else if (dest_select_by_input === "rootaccount") {
                        courses_url = `https://${hostname}/api/v1/accounts/1/courses?per_page=50&sort=sis_course_id&order=asc`;
                    };
                    populateDestinationSelection(courses_url, $(this).val());
                };
            });
        }
    }

    function populateDestinationSelection(url, dest_type, select_obj_identifier="#copy_rubric_select_dest") {
        // Populate the destination selection input by parsing the JSON resulting from the URL, and the destination type.
        var select_obj = $(select_obj_identifier);
        var json_res = getPaginatedRequest(url);

        for (var i = 0; i < json_res.length; i++) {
            var cur = json_res[i];
            var cur_id = cur['id']; // Preference 'sis_course_id' over 'id' if available
            var sis_keyword = `sis_${dest_type}_id`;
            if (sis_keyword in cur && cur[sis_keyword] !== "" && cur[sis_keyword] !== null) {
                cur_id = cur[sis_keyword];
            }
            select_obj.append("<option value='" + cur['id'] + "'>" + cur_id + " - " + cur['name'] + "</option>");
        };
    }

    function openDialog() {
        try {
            createDialog();
            $('#kk_rubric_dialog').dialog({
                'title' : 'Copy Rubrics',
                'autoOpen' : false,
                'buttons' : [ {
                    'text' : 'Copy',
                    'click' : copyRubrics
                }, {
                    'text' : 'Cancel',
                    'click' : function() {
                        $(this).dialog('close');
                        var el = document.getElementById('kk_rubric_text');
                        if (el) {
                            el.value = '';
                        }
                        errors = [];
                        updateMsgs();
                    }
                } ],
                'modal' : true,
                'height' : 'auto',
                'width' : '80%'
            });
            if (!$('#kk_rubric_dialog').dialog('isOpen')) {
                $('#kk_rubric_dialog').dialog('open');
            }
        } catch (e) {
            console.log(e);
        }
    }

    function getCheckboxValues() {
        // Get the values of the checked checkbox inputs for rubric selection
        var results = [];
        $('.copy_rubric_cb:checkbox:checked').each(function () {
            results.push($(this).val());
        });
        return results;
    }

    function capitaliseFirstLetter(string) {
        // Capitalise the first letter of a string.
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function copyRubrics() {
        // Initiate the copy of rubrics
        //Step 1: Get all rubric IDs selected, and the target course/account ID
        var rubric_ids = getCheckboxValues();
        var context_type = $("input:radio[name=copy_rubric_dest_type]:checked").val();
        var context_id = $("#copy_rubric_select_dest").val();
        // console.log(rubric_ids);
        // console.log("context_type=" + context_type);
        // console.log("context_id=" + context_id);

        //Step 2: For each rubric, get the rubric
        for (var i = 0; i < rubric_ids.length; i++) {
            var cur_id = rubric_ids[i];
            var cur_rubric_link = `https://${hostname}/api/v1${pathname}/${cur_id}`;
            // console.log(cur_rubric_link);
            var rubric_json = getRequest(cur_rubric_link);
            // console.log("Data received from getRequest: " + rubric_json);

            //Step 3: Structure the rubric for POST
            var data = {};
            data['rubric[title]'] = rubric_json['title'];
            data['rubric[points_possible]'] = rubric_json['points_possible'];
            data['rubric_association[use_for_grading]'] = false;
            data['rubric_association[hide_score_total]'] = rubric_json['hide_score_total'];
            data['rubric_association[hide_points]'] = false;
            data['rubric_association[hide_outcome_results]'] = false;
            data['rubric[free_form_criterion_comments]'] = rubric_json['free_form_criterion_comments'];
            data['rubric_association[id]'] = null;
            data['rubric_association_id'] = null;
            //Criteria here
            for (var n = 0; n < rubric_json['data'].length; n++) {
                var cur_crit_prefix = `rubric[criteria][${n}]`;
                var cur_criterion = rubric_json['data'][n];
                data[cur_crit_prefix + "[description]"] = cur_criterion['description'];
                data[cur_crit_prefix + "[points]"] = cur_criterion['points'];
                data[cur_crit_prefix + "[learning_outcome_id]"] = null;
                data[cur_crit_prefix + "[long_description]"] = cur_criterion['long_description'];
                data[cur_crit_prefix + "[id]"] = null;
                data[cur_crit_prefix + "[criterion_use_range]"] = cur_criterion['criterion_use_range'];
                for (var k = 0; k < cur_criterion['ratings'].length; k++) {
                    var cur_rating_prefix = `${cur_crit_prefix}[ratings][${k}]`;
                    var cur_rating = cur_criterion['ratings'][k];
                    data[cur_rating_prefix + "[description]"] = cur_rating['description'];
                    data[cur_rating_prefix + "[long_description]"] = cur_rating['long_description'];
                    data[cur_rating_prefix + "[points]"] = cur_rating['points'];
                    data[cur_rating_prefix + "[id]"] = 'blank';
                };
            };
            //End criteria
            data['title'] = rubric_json['title'];
            data['points_possible'] = rubric_json['points_possible'];
            data['rubric_id'] = 'new';
            data['rubric_association[association_type]'] = capitaliseFirstLetter(context_type);
            data['rubric_association[association_id]'] = context_id;
            data['rubric_association[purpose]'] = "bookmark";
            data['skip_updating_points_possible'] = false;
            data.authenticity_token = getCsrfToken();

            //Step 4: Then POST the rubric to new destination
            var new_rubric_link = `https://${hostname}/${context_type}s/${context_id}/rubrics`;
            // console.log("Rubric POST link: " + new_rubric_link);
            $.ajax({
                'cache' : false,
                'url' : new_rubric_link,
                'type' : 'POST',
                'data' : data,
            }).done(function() {
                updateMsgs();
                //$('#kk_rubric_dialog').dialog('close');
                //window.location.reload(true);
            }).fail(function() {
                console.log(data);
                errors.push(`Failed to replicate ${cur_rubric_link} to ${new_rubric_link} \nSee browser console for debug info.`);
                updateMsgs();
            });
        };
        //Close dialog if no errors
        if (errors.length === 0) {
            $('#kk_rubric_dialog').dialog('close');
            window.location.reload(true);
        };
    }

    function updateMsgs() {
        var msg = document.getElementById('kk_rubric_msg');
        if (!msg) {
            return;
        }
        if (msg.hasChildNodes()) {
            msg.removeChild(msg.childNodes[0]);
        }
        if (typeof errors === 'undefined' || errors.length === 0) {
            msg.style.display = 'none';
        } else {
            var ul = document.createElement('ul');
            var li;
            for (var i = 0; i < errors.length; i++) {
                li = document.createElement('li');
                li.textContent = errors[i];
                ul.appendChild(li);
            }
            msg.appendChild(ul);
            msg.style.display = 'inline-block';
        }
    }
})();
