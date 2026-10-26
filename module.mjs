// @ts-check
import { module } from "@prisma/composer";
import sshTownService from "./service.mjs";

export default module("ssh-town", ({ provision }) => {
  provision(sshTownService, { id: "sshtown" });
});
