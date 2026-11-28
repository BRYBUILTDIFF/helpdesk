# User flowchart — HelpDesk AI

Sign in, get IT help or practice tasks, then sign out when finished.

```mermaid
flowchart TD
    START([Start]) --> LOGIN[Sign in with a user account]
    LOGIN --> VALID{Sign-in successful?}
    VALID -- No --> ERROR[Show sign-in error]
    ERROR --> LOGIN
    VALID -- Yes --> PASSWORD{Password change required?}
    PASSWORD -- Yes --> CHANGE[Change password]
    CHANGE --> PASSWORD
    PASSWORD -- No --> HOME[User workspace]
    HOME --> TASK{Choose an activity}

    TASK --> HELP[Get IT help]
    HELP --> ASK[Ask an IT question]
    ASK --> RESPONSE[Receive guidance or a policy message]
    RESPONSE --> MORE{Ask a follow-up?}
    MORE -- Yes --> ASK
    MORE -- No --> TASK

    TASK --> CHATS[Manage conversations]
    CHATS --> TASK

    TASK --> MODULE[Choose a simulation]
    MODULE --> PRACTICE[Follow tasks in the available workspace]
    PRACTICE --> RESULT[Complete or end the simulation]
    RESULT --> TASK

    TASK --> SECURITY[Manage account security]
    SECURITY --> SESSION{Still signed in?}
    SESSION -- Yes --> TASK
    SESSION -- No --> FINISH([End])
    TASK --> LOGOUT[Sign out]
    LOGOUT --> FINISH
```

## Activities

| Activity | What the user does |
| --- | --- |
| Get IT help | Describe an IT problem and ask follow-up questions. |
| Manage conversations | Start, reopen, search, favorite or delete your conversations. |
| Practice simulations | Choose a module, follow its tasks, and complete or end the simulation. |
| Manage account security | Change your password or sign out of all devices. |

## Notes

- Use an active account provided by an admin.
- A required password change must succeed before proceeding.
- AI assistance follows IT scope and safety rules.
- If a simulation is unavailable, retry or choose another activity. Rejected completion requires correction before it can be recorded.
- Terminal completion uses verified simulated steps. Windows completion is self-reported.
- Returning to activity selection is a navigation choice. End an active simulation before leaving it.
- Signing out of all devices ends the current session.

Related: [Role use cases](GENERALIZED_USE_CASES.md) and [Admin flowchart](ADMIN_FLOWCHART.md).
