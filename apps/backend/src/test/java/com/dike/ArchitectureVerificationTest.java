package com.dike;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ArchitectureVerificationTest {

  private final JavaClasses classes =
      new ClassFileImporter()
          .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
          .importPackages("com.dike");

  @Test
  void verifiesModulithBoundaries() {
    ApplicationModules.of(DikeApplication.class).verify();
  }

  @Test
  void controllersMustNotDependOnInfrastructureOrRepositories() {
    classes()
        .that()
        .haveSimpleNameEndingWith("Controller")
        .should()
        .onlyDependOnClassesThat()
        .resideOutsideOfPackages("..infrastructure..", "..repository..")
        .allowEmptyShould(true)
        .check(classes);
  }

  @Test
  void domainMustNotDependOnDeliveryOrPersistenceFrameworks() {
    noClasses()
        .that()
        .resideInAPackage("..domain..")
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage(
            "org.springframework.web..", "org.springframework.data..", "software.amazon.awssdk..")
        .allowEmptyShould(true)
        .check(classes);
  }

  @Test
  void negativeFixturesProveArchitectureRulesAreActive() {
    JavaClasses fixtures = new ClassFileImporter().importPackages("com.dike.archfixtures");

    ArchRule controllerRule =
        noClasses()
            .that()
            .haveSimpleNameEndingWith("Controller")
            .should()
            .dependOnClassesThat()
            .resideInAPackage("..repository..");
    ArchRule domainRule =
        noClasses()
            .that()
            .resideInAPackage("..domain..")
            .should()
            .dependOnClassesThat()
            .resideInAPackage("org.springframework.data..")
            .allowEmptyShould(true);
    ArchRule internalModuleRule =
        noClasses()
            .that()
            .resideInAPackage("..modulea..")
            .should()
            .dependOnClassesThat()
            .resideInAPackage("..moduleb.internal..");

    org.junit.jupiter.api.Assertions.assertAll(
        () ->
            org.junit.jupiter.api.Assertions.assertThrows(
                AssertionError.class, () -> controllerRule.check(fixtures)),
        () ->
            org.junit.jupiter.api.Assertions.assertThrows(
                AssertionError.class, () -> domainRule.check(fixtures)),
        () ->
            org.junit.jupiter.api.Assertions.assertThrows(
                AssertionError.class, () -> internalModuleRule.check(fixtures)));
  }
}
