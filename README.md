// FOR FRONTEND AND BACKEND

1 npm install

2 Create Auth0 SPA aplication on Applications/Applications, setting "Allowed Callback URLs" your frontend base url and frontend url with slash, same thing for "Allowed Logout URLs" and "Allowed Web Origins"

3 Create Auth0 API on Application/APIs and grant acces to the SPA aplication on this API / "Aplication access". Your SPA aplication must appear as "AUTHORIZED"

4 On your API go to Settings and scroll down to reach the "Application Access Policy" section and set "Allow via client-grant" on "User Access" and "Client Access"

5 Once SPA aplication an API is created, use the information provided to complete the .env as the .env.example specifies

// FOR BACKEND

6 Create Auth0 M2M (machine to machine) application on Applications/Applications

7 On your M2M application go to "APIs" and your API must appear as "Client Access" AUTHORIZED and Auth0 Management API "User Access" as AUTHORIZED

8 Go to your API, "Application Access" and grant access to your M2M application for Client Access, must appear as AUTHORIZED

9 Make sure that on your Auth0 Management API on Appplication/APIs, on "Application Access" section your SPA application and M2M application has "User Access" as AUTHORIZED

10 Create a Mongo Atlas account, once done go to "Clusters", select "Connect", select "Drivers", select Driver Node.js and use the link given to connect your project to the database. For example: mongodb+srv://User:Pasword@clustername.1rvm4.mongodb.net/DatabaseName?retryWrites=true&w=majority

11 Create a Backblaze account, once done create a new bucket for your project and an application key, saving the information of both. Use it to complete the .env as the .env.example specifies

// RUN PROJECT

12 Run the project with "npm run start"

