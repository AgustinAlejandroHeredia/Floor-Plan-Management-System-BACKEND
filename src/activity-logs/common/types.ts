export enum ActionType {

    USER_JOINS_PLATFORM = "user joins platform",
    EDIT_USER = "user edits self credentials",
    CHANGE_USER_GLOBAL_ROLE = "change user global role",

    SEND_INVITATION = "send invitation",
    DELETE_INVIATION = "delete invitation",

    CHANGE_ACTION_PERMISSIONS = "change actions permissions",
    CHANGE_USER_ORGANIZATION_ROLE = "change user organization role",
    CHANGE_USER_PAGE_ROLE = "change user page role",

    CREATE_ORGANIZATION = "create organization",
    EDIT_ORGANIZATION = "edit organization",
    EDIT_ORGANIZATION_PERMISSIONS = "edit organization permissions",
    DELETE_ORGANIZATION = "delete organization",
    EDIT_ORGANIZATION_USER_ROLE = "update organization user role",
    JOIN_ORGANIZATION = "join organization",
    ADD_USER_TO_ORGANIZATION = "add user",
    KICK_USER_FROM_ORGANIZATION = "kick user",
    LEAVE_ORGANIZATION = "user left organization",

    CREATE_PROJECT = "create new project",
    EDIT_PROJECT = "edit project",
    DELETE_PROJECT = "delete project",
    EDIT_PROJECT_USER_ROLE = "update project user role",

    UPLOAD_BLUEPRINT = "upload blueprint",
    EDIT_BLUEPRINT = "edit blueprint",
    EDIT_BLUEPRINT_SECTIONVIEWS = "update blueprint section views",
    DELETE_BLUEPRINT = "delete blueprint",
    DOWNLOAD_BLUEPRINT = "download blueprint",

    ENQUEUE_INFERENCE_JOB = "ask for inference job",
    CANCEL_INFERENCE_JOB = "cancel pending inference job",

    TEST_ACTION = "testing action log",
    
}