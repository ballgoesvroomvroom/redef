# Full Stack Web Application



A studying application to help with self-revision.

Made with [NodeJs](NodeJs) with the [express](express) module doing the heavy-lifting for the server-side, client-side is purely HTML, CSS and JS, served in static pages (SSG).

Didn't implement any technology stack, project is as barebones as it can be.


## Demo

Try it out at: [redef.catonwater.com](redef.catonwater.com)<br>
Refer to [getting started](#getting-started)

Use one of the following publicly available license keys to register for an account:
```

2fae f91a 129b a21b

4c2e de34 3dec 982f

7df2 7a3c dd1f 1ead

```
Upload this [demo file](https://catonwater.com/resources/file.txt)


## Screenshots

![.png](image of home page with test history)

![.png](image of uploaded data, with new and modified sections expanded, showing the difference)

![.png](image of test page with the chapter, prompt and answer box)

![.png](image of summary of test with questions alongside attempt and correct answer)

![.png](image of study page, showing the different colours used)

![.png](second image of study page, showing the different colours used)



## Getting started
After uploading the note file (`.txt`), head over to `/create` via the '[ New test ]' button.

You can create a new test using presets or simply by selecting the topics or even the individual words you want. A test can consists of different chapters and it doesn't have to be the full chapter.

You should be forwarded to a new page, `/test/l/:test_id`, the questions should be in the order of how the chapters are arranged, earliest uploaded to recently uploaded. To override this behaviour and have the questions be randomised, head to `/randomise`, though this won't affect already created tests.

At the end of the test, you can review the questions and your attempts, alongside with the correct answer.

To display the uploaded contents, head over to `/study` page.


## Data input

The data (words and definitions) are all exported from Google Documents as a `.txt` file. Google Documents is really accessbile from any device, hence the decision. Annotations are also possible without affecting the parsed content.

![image of notes in google documents](https://catonwater.com/img/includes/full-stack-web-app/notes.png)



The notes itself can contain a hierarchy system where a sub chapter (denoted by a/multiple hyphen '-' at the start of the chapter name) can be a direct children of another chapter defined directly above it, building a tree along the way.

Since the data is stored "recursively" to maintain parent-child relationships, there should be a limit on how far the indents can go. Creating "deep descendants" of a root chapter is possible but is not advised.



Keywords (defined by a "keywords: " header on a new line) contains the user-defined keywords. Regular expressions can be used (if toggled true via preferences; default: `true`) in the keywords itself to match for multiple variants of the same word, such as different word form or tense.<br>Keywords are always wrapped in word boundary '\b' to search for occurrence.

Though there are some characters that need to escaped if the literal form is to be used, such as assertion characters for regular expression. This can be ignored if preferences disabled regular expressions matching, the server will escape it for you.

Data is cached client-sided and a metadata value is used as an update tick whenever data is updated server-side to allow client-side to sync. This reduces the amount of transmissions of large data, consequently lower bandwidth usage.


## Self-testing

The main dish of this entire application; being able to test users on definitions

It grades the answer using regular expressions to match for user-defined keywords, with the grades being the total matched keywords against the total keywords count.



### Syntax for notes (input)

```

[Chapter Name]



!Elephant:

Giant four-legged animal

keywords: giant, four, animal



!Horse:

Powerful four-legged animal

keywords: powerful, four, animal

```

- Chapter header are matched with `/(?<!\\)^\[(.+)\]\s*$/g`.

- If an opening square bracket is to be used at the start of a new line, either add a space padding before the opening square bracket or escape it with `\`. Or even added non-whitespace characters after the closing square bracket

- There can be trailing whitespace after the closing square bracket but no other characters.

- If `Chapter Name` is a sub chapter of a root chapter, we can give it an indent by adding one hyphen at the start. E.g. `[-Chapter Name]`; descendants of a root chapter can be added but there has to be a direct parent. E.g. a `[---Chapter Name]` must have either a chapter with 3 indent or lower above it (an indent of 0, no hyphens, is a root chapter).

- Hyphens are captured using `/^-+ ?/g` on the actual chapter name (without the square brackets).

- Only one space between the hypen and the name is allowed. Chapter name will be as is, discarding the addition space after the hyphen (if present).

- To include actual hyphens in the name itself, add a/multiple space(s) right after the opening bracket and right before the first hyphen itself.



## Database

Chose a simple approach to storing data by using `.json` files. Relational databases was not really appropriate and I had no other experience with other NoSQL databases, and with the time constraint, I didn't want to spend too long on a minor aspect of the entire application.



## Special features

Aesthetic appeals, highlighter of a light tone to mark out marked keywords within content answer (the definition).



Study along, a `/study` path to display all notes along with their keywords. Contents are also highlighted accordingly based on keywords.



Ability to store the history of 7 tests. Allowing you to view the past 7 tests.



Come back where you left off, the tests save progress on a per question basis.



Able to view the summary of all questions of a completed test, displayed alongside with the content's answer.



Front-end is mobile friendly too, maximising all space on the narrow screen.



Irrelevant data can be added to the notes file as comments, denoted by adding three consecutive keywords and NOTHING else (not even any whitespace on the same line). Sandwich the multi-line comment by "==="; similar to Python's multi-line comments but instead of quotes, it uses equal signs.



Create presets which can contains a mixed collection of chapters/words to test yourself again easily. This helps with the spaced repetition method. Presets can contain a single word from a chapter and a whole other chapter, it's really a freeflow thing.



Negated keywords, denoted by a tilde at the start, can be used to accurately highlight the contents. If a word occurs before the actual word you want to highlight, you can use the negated keyword to skip over ONE iteration of the word. Use multiple negated keywords if there are multiple occurrences you want to skip.

E.g.

```

The fast donkey jumped over the fast-moving fox.

keywords: ~fast, fast

```

In this case, the second occurrence of 'fast' (in 'fast-moving') will be highlighted since a hyphen character is also considered as a word boundary :).



## Caveats

If regular expressions is toggled true, malformed keywords contained illegal regular expressions will error on the server-side (not handled, yikes), returning a 400 error to the client. Making it really hard to "debug" which part of the notes went wrong especially if the note file is really large.



Unable to edit chapter name or remove any chapter or words (`/edit` page is work in progress);

Though a `/api/words/modify` endpoint exists on the server, working on a `PATCH` request.



Weak server validation. Early stage of development was intended for my own use only, hence did not heavily enforce data validation on server side, especially checking for data format, though client side does vet and parse the data accordingly (all errors and malformed inputs are handled there). Though there is still the possibility of sending malformed raw data directly to the server using a POST request.



Bad navigation. There is a lack of navigation buttons, the main means of navigation is via changing the url path directly in the browser; with the root being `\`.



Compatibility between browsers; application was tested only in a Chrome browswer, an unintentional bug may occur if another browser is used. Especially of older browsers where `fetch()` is not supported or the non-standard `contenteditable` (user input) causing missing contents when parsed

## Planned features
I only had that much time to invest developing this application, below are a few features I plan to implement during my free time

- Ability to upload data through the use of URIs (mainly URLs)
- Text-to-speech feature embedded into `/study` page
- Spinners to indicate loading events (right now, page feels rather unresponsive)
- Better navigation with buttons
- A 'retake test' button at the end of a test where it automatically generates the same test, whilst following the `randomOrder` preference toggled via `/randomise`
- Frontend page for editing uploaded content
- Better sessions (timeouts too often and when server does a restart, session data is practically gone)

## Environment variables
Currently uses `JWT_TOKEN` and `SESSIONSECRET`.<br>
Both takes in a hexadecimal string of arbitrary length.

## Closing note
Any contributions are welcomed, simply create a PR and I'll take a look at it.

GitHub repository: [redef](https://github.com/ballgoesvroomvroom/redef)
