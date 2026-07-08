import { createClerkClient } from "@clerk/express";

const token = "eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18zR0JHMnVYVmVSWFFhYktJVzNIaFowMnRBdDciLCJvaWF0IjoxNzgzNDM4Nzc2LCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjUxNzMiLCJleHAiOjE3ODM0Mzg4MzYsImZ2YSI6WzYsLTFdLCJpYXQiOjE3ODM0Mzg3NzYsImlzcyI6Imh0dHBzOi8vbG92aW5nLWhvbmV5YmVlLTQ3LmNsZXJrLmFjY291bnRzLmRldiIsIm5iZiI6MTc4MzQzODc2Niwic2lkIjoic2Vzc18zR0JJOXlFVGFoU3gyaWRVMnl3dEd2YWVLc0siLCJzdHMiOiJhY3RpdmUiLCJzdWIiOiJ1c2VyXzNHQkdTMm5uanBOUVlVMlp5c3FXTTIydHhwNiIsInYiOjJ9.KEmo2rtPh8IJjRUfe6sPc1IWDR9KfgMOmshrgTz-8Xamuz1GeA0OOlocgutBg_slw0F8rOjHkhBPsDF7II_szKoXNKATPzxaykxGryXCS-0JRoEk2j3P0NsL0utrK9Oha0vDNRH5bwB3cVb8jTlQ0cGGFkL5p3w8HeD66gaqb_dvaW2Ijei6EwdwrA8zU4Cptd8K1cKBEhxBd7-_RAMI6cIGonD5hfdKlC_4-HrgjX9MsZL-o4VeUausSj6bgGvXxana5AHZpDAQLfh0lBJLkauK3tfeOYc2uRtWyblFopmsM6OJT5KTFC-wIX5OgIWEQE169R6pH7lpqcOvOeVJzw";

const clerkClient = createClerkClient({
  secretKey: "sk_test_nXX0mJySQDjs5OqGopfW4GcWejnDZDl8dpFIgY3Ee8",
  publishableKey: "pk_test_bG92aW5nLWhvbmV5YmVlLTQ3LmNsZXJrLmFjY291bnRzLmRldiQ"
});

try {
  console.log("Verifying token...");
  const authState = await clerkClient.authenticateRequest(
    new Request('http://localhost:8080/api/users/me', {
      headers: new Headers({
        authorization: `Bearer ${token}`
      })
    })
  );
  console.log("Auth state isSignedIn:", authState.isSignedIn);
  console.log("Auth state isTokenExpired:", authState.isTokenExpired);
  console.log("Auth state status:", authState.status);
  console.log("Auth state error message:", authState.message, authState.reason);
  console.log("Claims:", authState.toAuth().sessionClaims);
} catch (err) {
  console.error("Verification crashed:", err);
}
