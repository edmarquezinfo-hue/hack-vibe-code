## Project Report: Orange Build (v1.dev)

**Author:** Ashish Kumar Singh

### I. Executive Summary

**Orange Build** is a sophisticated, spec-driven, text-to-webapp generation system. It fundamentally differs from simple "vibe-based" coding agents by employing an iterative, phase-by-phase software development lifecycle. The system is engineered to be a state-of-the-art platform, rivaling competitors like *v0*, *lovable*, or *b0lt*. A key feature is its ability to deliver a functional UI within the first 1-2 minutes, followed by iterative backend development and feature enhancement. This process incorporates rigorous, parallel code review and correction to ensure a bug-free final product.

### II. System Architecture

The Orange Build ecosystem operates on a dual-repository model:

  * **v1 Frontend+Backend System**: This is the core of the operation, deployed on **Cloudflare Workers**. It houses the multi-agent code generation system built with the *CF Agent SDK*.
      * **Noteworthy Abstraction**: All our specialized agents function as internal abstractions under a single, Durable Object-backed `Agent` class object.
  * **Runner-Service**: Deployed on **Cloudflare Containers**, this serves as a sandboxed environment for executing and previewing AI-generated code. It exposes services through *Cloudflared tunnels* and provides authenticated REST APIs. It also includes the capability to permanently deploy applications to **Cloudflare Workers**.

### III. The User Journey & Core Generation Process

The system is designed for a seamless user experience, from prompt to deployment:

1.  **Prompt Entry**: The user initiates the process by writing a detailed prompt.

2.  **Template Selection**: The ***Template Selector Agent*** intelligently chooses a suitable pre-configured template (e.g., Next.js, Vite).

3.  **Blueprint Crafting**: Within 10-30 seconds, the ***Blueprint Agent*** crafts a detailed spec sheet (the "blueprint") and streams it to the user.

4.  **Code Generation Initiation**:

      * A new ***CodeGeneratorAgent*** (a Cloudflare Agents durable object) is instantiated.
      * The user's session is upgraded to a WebSocket connection.
      * The client application signals the start of the generation process.

5.  **Parallel Processing**: The ***CodeGeneratorAgent*** kicks off three workflows simultaneously:

      * **Project Bootstrapping**: The project is set up on the *Runner-Service*.
      * **Environment Setup**: The ***Project Setup Agent*** plans necessary commands, such as dependency installations. This agent operates in a continuous loop to correct any setup mistakes.
      * **Code Generation Loop**: The `generateAll` code generation loop is initiated.

### IV. The `generateAll` Loop: A Pseudo-Code Overview

```plaintext
BROADCAST "generation started"
SET isGenerating = true
GET nextPhase and currentIssues

WHILE nextPhase exists AND not empty:
    shouldHalt = IMPLEMENT_PHASE(nextPhase, currentIssues)
    UPDATE currentIssues

    IF shouldHalt OR nextPhase.lastPhase:
        BREAK

    nextPhase = GENERATE_NEXT_PHASE(currentIssues)
    IF no nextPhase:
        BREAK

    IF nextPhase has install commands:
        EXECUTE_COMMANDS(installCommands)

IMPLEMENT_PHASE("Finalization and Review", currentIssues)

FOR i = 0 to reviewCycles:
    reviewResult = REVIEW_CODE()
    IF no reviewResult OR no issues found:
        BREAK

    FOR each fileToFix in reviewResult.files_to_fix:
        IF file requires code changes:
            REGENERATE_FILE(fileToFix)
            DEPLOY_TO_RUNNER([fileToFix])

SET isGenerating = false
UPDATE_DATABASE(status: "completed")
BROADCAST "generation complete"
```



*This `generateAll` loop is slated to be replaced by a more dynamic ***Development Orchestration Agent***.*

### V. Two-Stage Code Generation & Quality Assurance

Our methodology ensures both speed and reliability through a two-pronged approach:

#### Stage 1: Core Project Development

1.  **Phase Implementation**: The ***Phase Implementor Agent*** generates all necessary code files for a given phase in a single, streaming API call. This is achieved using our custom-designed **SCOF (Shell Command Output Format)**, a structured format resilient and reliable for LLMs.
2.  **Real-time Correction**: As each file completes, a dedicated ***Realtime Code Fixer Agent*** is spawned. This state-backed agent reviews the code for bugs and applies `diff` patches to fix them in real-time.
3.  **Deployment & Analysis**: The fixed files are deployed to the *Runner-Service*. We then perform static analysis and capture runtime errors to generate an `IssueReport`.
4.  **Next Phase Planning**: The `IssueReport` is fed to the ***Phase Planner Agent***, which plans the subsequent development phase based on the current state and identified issues.

#### Stage 2: Finalization and Review

  * **Thorough Code Review**: The ***Code Review Agent*** conducts a more detailed analysis to identify and recommend fixes for any remaining bugs or runtime errors.
  * **Targeted Code Fixing**: The ***Code Regeneration Agent*** addresses the identified issues on a file-by-file basis, ensuring rapid resolution for the end user.

### VI. Issue Resolution Systems

We have implemented two distinct systems for bug detection and fixing:

  * **Reactive System**: Major development agents (***Phase Implementation***, ***Phase Planner***, ***Code Review***) are continuously fed the latest runtime errors, allowing them to address issues in subsequent phases.
  * **Proactive System**: To counteract the natural delay of the reactive system, the ***Realtime Code Fixing Agent*** proactively identifies and resolves bugs *before* they can cause runtime issues. Other agents are also instructed to regenerate files if they suspect the presence of bugs.

### VII. The Runner Service: A Closer Look

The **Runner Service** is a NodeJS sandbox environment (with a GoLang rewrite near completion) that provides the foundational infrastructure for our development process.

  * **Key Capabilities**: It handles project bootstrapping, file modification, command execution, and deployment to **Cloudflare Workers**.
  * **Efficient Templating**: Templates are pre-configured with pre-installed NodeJS packages using `bun`, which leverages hardlinks and caching to prevent duplication.
  * **Instance Lifecycle**:
    1.  A template is copied to a unique directory.
    2.  An open port is allocated.
    3.  A **Cloudflared tunnel** is launched to expose the application to the internet for preview.
    4.  `bun install` and `bun run dev` are executed in parallel to install dependencies and start the hot-reloading dev server.
  * **Ephemeral Environment**: Currently, containers have a lifespan of 10-15 minutes, making them ideal for rapid development and previewing.

### VIII. Potential Innovations & Patentable Assets

We believe the following aspects of our system represent significant innovations:

  * The multi-agent architecture for code development.
  * The **SCOF** code output format for LLMs.
  * The Markdown-based structured output format (zod \<-\> markdown) for LLMs.
  * The robust, search-replace `diff` parser and its layered application logic.

### IX. Current Roadmap

Our immediate and future priorities include:

  * **Agent Advancement**: Transitioning from the `generateAll` loop to a fully flexible ***Development Orchestration Agent***.
  * **Enhanced User Interaction**: Adding support for conversational follow-ups and edits.
  * **Feature Expansion**:
      * *Export to GitHub* functionality.
      * Saving, forking, and viewing applications.
      * Implementing community features (feeds, boards, comments, likes, etc.).
  * **Reliability Improvements**:
      * Developing a real-time reactive issue resolution system for even faster bug fixes.
      * Benchmarking and fine-tuning models for all agents.
      * Implementing WebSocket reconnection for seamless session resumption.