# Data flow diagram — HelpDesk AI

These diagrams show what data enters the system, where it is processed and where it is stored.

## Context diagram

The whole system is shown as one process.

```mermaid
flowchart LR
    A[Admin]
    U[User]
    S([0. HelpDesk AI])
    AI[AI service]
    LAB[Windows lab service]

    A -->|Sign-in details and management requests| S
    S -->|Account status, reports and management results| A
    U -->|Sign-in details, IT questions and simulation actions| S
    S -->|Account status, AI guidance, conversations and progress| U
    S -->|AI prompts and relevant context| AI
    AI -->|Generated answers and module drafts| S
    S -->|Windows lab start and end requests| LAB
    LAB -->|Lab status and connection details| S
```

## Level 1 diagram

The system is divided into four main processes.

```mermaid
flowchart LR
    A[Admin]
    U[User]
    AI[AI service]
    LAB[Windows lab service]

    subgraph SYSTEM[HelpDesk AI]
        P1([1. Manage access])
        P2([2. Manage system])
        P3([3. Provide IT help])
        P4([4. Run simulations])

        D1[(D1. Accounts and sessions)]
        D2[(D2. Policies and activity records)]
        D3[(D3. Conversations)]
        D4[(D4. Simulation modules and progress)]
    end

    A -->|Sign-in and account security details| P1
    U -->|Sign-in and account security details| P1
    P1 -->|Account and session updates| D1
    D1 -->|Account and session records| P1
    P1 -->|Access result| A
    P1 -->|Access result| U

    A -->|Account, policy, module and report requests| P2
    P2 -->|Management results and reports| A
    P2 -->|Account changes| D1
    D1 -->|Account records| P2
    P2 -->|Policy changes and activity records| D2
    D2 -->|Policies and activity records| P2
    P2 -->|Module changes| D4
    D4 -->|Modules and progress summaries| P2
    P2 -->|Module generation prompts| AI
    AI -->|Generated module drafts| P2

    U -->|IT questions and conversation requests| P3
    P3 -->|Guidance and conversation results| U
    D2 -->|AI rules and restrictions| P3
    P3 -->|Policy events and restriction updates| D2
    D3 -->|Saved conversations| P3
    P3 -->|Conversation updates| D3
    P3 -->|Allowed prompts and relevant context| AI
    AI -->|Generated answers| P3

    U -->|Module choices, task actions and completion requests| P4
    P4 -->|Instructions, lab access and progress| U
    D4 -->|Available modules and saved progress| P4
    P4 -->|Attempt and progress records| D4
    P4 -->|Windows lab start and end requests| LAB
    LAB -->|Lab status and connection details| P4
```

## Data stores

| Store | Data kept |
| --- | --- |
| D1. Accounts and sessions | Account details, password hashes, roles and sign-in sessions. |
| D2. Policies and activity records | AI rules, restrictions, policy events and admin audit records. |
| D3. Conversations | Personal chat history and conversation state. |
| D4. Simulation modules and progress | Module definitions, drafts, attempts and completion records. |

## Notes

- Rectangles are external actors or services, rounded shapes are processes, and cylinders are data stores.
- Arrow labels name the data being exchanged; they do not show the order of steps.
- Stores are logical groups, not individual database tables.
- Admin processes require admin access. Users access only their own conversations and progress.
- AI answers are checked against system policies before being shown.
- The Windows lab service represents AWS provisioning and Guacamole access. Terminal simulations run within the system.
- Terminal completion uses verified simulated steps. Windows completion is self-reported.

Related: [Role use cases](GENERALIZED_USE_CASES.md), [Admin flowchart](ADMIN_FLOWCHART.md) and [User flowchart](USER_FLOWCHART.md).
